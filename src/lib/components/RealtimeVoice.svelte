<!-- src/lib/components/RealtimeVoice.svelte -->
<script>
	/** @typedef {import('$lib/session').SessionState} SessionState */

	/** @type {{
	 *   onstatus?: (status: SessionState) => void,
	 *   onlog?: (entry: string) => void,
	 *   onerror?: (message: string) => void,
	 *   onusertranscript?: (text: string) => void,
	 *   onassistantdelta?: (delta: string) => void,
	 *   onassistantdone?: (fullText: string) => void
	 * }} */
	let { onstatus, onlog, onerror, onusertranscript, onassistantdelta, onassistantdone } = $props();

	/** @type {SessionState} */
	let status = $state('idle');
	let muted = $state(false);

	/** @type {RTCPeerConnection | null} */
	let pc = null;
	/** @type {RTCDataChannel | null} */
	let dc = null;
	/** @type {MediaStream | null} */
	let localStream = null;
	/** @type {HTMLAudioElement | undefined} */
	let remoteAudioEl = $state();

	function log(entry) {
		onlog?.(entry);
	}

	function setStatus(next) {
		status = next;
		onstatus?.(next);
	}

	function handleServerEvent(e) {
		// Once we've started (or finished) tearing down, ignore anything that
		// still arrives on the data channel — this is exactly the kind of
		// "stray traffic after end" the debug panel should never have to show.
		if (status === 'disconnecting' || status === 'disconnected') {
			log(`Realtime: ignored stray event after disconnect (${status})`);
			return;
		}

		/** @type {any} */
		let event;
		try {
			event = JSON.parse(e.data);
		} catch {
			return;
		}

		switch (event.type) {
			case 'session.created':
				log('Realtime: session created');
				break;
			case 'input_audio_buffer.speech_started':
				log('Realtime: listening…');
				break;
			case 'input_audio_buffer.speech_stopped':
				log('Realtime: processing…');
				setStatus('sending');
				break;
			case 'conversation.item.input_audio_transcription.completed': {
				const text = (event.transcript ?? '').trim();
				if (text) onusertranscript?.(text);
				break;
			}
			case 'response.output_audio_transcript.delta':
			case 'response.audio_transcript.delta':
				if (status !== 'sending') setStatus('sending');
				onassistantdelta?.(event.delta ?? '');
				break;
			case 'response.output_audio_transcript.done':
			case 'response.audio_transcript.done':
				onassistantdone?.((event.transcript ?? '').trim());
				break;
			case 'response.done':
				log('Realtime: response complete');
				if (status === 'sending') setStatus('connected');
				break;
			case 'error':
				log(`Realtime error: ${event.error?.message ?? event.message ?? 'unknown error'}`);
				onerror?.(event.error?.message ?? event.message ?? 'Realtime error');
				break;
			default:
				break;
		}
	}

	export async function connect() {
		if (status === 'connecting' || status === 'disconnecting') return;
		if (pc || dc || localStream) {
			log('Restarting: closing previous session before reconnecting…');
			teardown();
		}

		setStatus('connecting');
		try {
			log('Realtime: requesting session token…');
			const tokenRes = await fetch('/api/realtime/session');
			const tokenData = await tokenRes.json();
			if (!tokenRes.ok || !tokenData?.value) {
				throw new Error(tokenData?.error || `Could not start realtime session (${tokenRes.status})`);
			}

			pc = new RTCPeerConnection();

			remoteAudioEl = document.createElement('audio');
			remoteAudioEl.autoplay = true;
			pc.ontrack = (e) => {
				if (remoteAudioEl) remoteAudioEl.srcObject = e.streams[0];
			};

			log('Realtime: requesting microphone…');
			localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			localStream.getTracks().forEach((track) => pc?.addTrack(track, /** @type {MediaStream} */ (localStream)));

			dc = pc.createDataChannel('oai-events');
			dc.addEventListener('message', handleServerEvent);
			dc.addEventListener('close', () => log('Realtime: data channel closed'));

			const opened = new Promise((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error('Realtime data channel timed out')), 15000);
				dc?.addEventListener('open', () => {
					clearTimeout(timeout);
					resolve(undefined);
				});
			});

			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);

			log('Realtime: connecting to OpenAI…');
			const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
				method: 'POST',
				body: offer.sdp,
				headers: {
					Authorization: `Bearer ${tokenData.value}`,
					'Content-Type': 'application/sdp'
				}
			});

			if (!sdpRes.ok) {
				throw new Error(`Realtime handshake failed (${sdpRes.status})`);
			}

			const answerSdp = await sdpRes.text();
			await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

			await opened;
			setStatus('connected');
			log('Realtime: conversation is live — just start talking');
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to connect realtime session';
			teardown();
			setStatus('error');
			log(`Realtime error: ${message}`);
			onerror?.(message);
		}
	}

	/**
	 * Actually releases every resource tied to the session: mic tracks, the
	 * data channel, and the peer connection (which is what truly ends the
	 * Realtime call server-side — there's no separate "close session" REST
	 * call for the WebRTC transport). Each step is isolated in its own
	 * try/catch so one failure can't leave the others un-cleaned-up, and
	 * every step is logged so the debug panel shows exactly what happened.
	 */
	function teardown() {
		if (dc) {
			try {
				const readyState = dc.readyState;
				dc.removeEventListener('message', handleServerEvent);
				dc.close();
				log(`Cleanup: closed data channel (was ${readyState})`);
			} catch (err) {
				log(`Cleanup error (data channel): ${err instanceof Error ? err.message : String(err)}`);
			}
			dc = null;
		}

		if (localStream) {
			try {
				const tracks = localStream.getTracks();
				tracks.forEach((track) => track.stop());
				log(`Cleanup: stopped ${tracks.length} microphone track(s)`);
			} catch (err) {
				log(`Cleanup error (microphone tracks): ${err instanceof Error ? err.message : String(err)}`);
			}
			localStream = null;
		}

		if (pc) {
			try {
				pc.ontrack = null;
				pc.close();
				log('Cleanup: closed peer connection');
			} catch (err) {
				log(`Cleanup error (peer connection): ${err instanceof Error ? err.message : String(err)}`);
			}
			pc = null;
		}

		if (remoteAudioEl) {
			remoteAudioEl.srcObject = null;
			remoteAudioEl = undefined;
		}
	}

	export function disconnect() {
		if (status === 'idle' || status === 'disconnecting' || status === 'disconnected') return;

		setStatus('disconnecting');
		log('Cleanup started: ending conversation…');
		teardown();
		setStatus('disconnected');
		log('Cleanup complete — session disconnected. No further API calls will fire until you start again.');
	}

	export function setMuted(next) {
		muted = next;
		localStream?.getTracks().forEach((track) => {
			track.enabled = !next;
		});
		log(next ? 'Realtime: microphone muted' : 'Realtime: microphone unmuted');
	}

	/** Send a typed message through the same live conversation. */
	export function sendText(text) {
		if (status !== 'connected' && status !== 'sending') {
			onerror?.(`Cannot send — session state is "${status}", not connected`);
			return;
		}
		if (!dc || dc.readyState !== 'open') {
			onerror?.('Realtime session is not connected yet');
			return;
		}

		setStatus('sending');
		dc.send(
			JSON.stringify({
				type: 'conversation.item.create',
				item: {
					type: 'message',
					role: 'user',
					content: [{ type: 'input_text', text }]
				}
			})
		);
		dc.send(JSON.stringify({ type: 'response.create' }));
	}
</script>

<section class="rounded-[1.75rem] bg-white p-4 shadow-soft sm:p-5">
	<div class="flex items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<span
				class="flex h-11 w-11 items-center justify-center rounded-full
				{status === 'connected' || status === 'sending' ? 'bg-brand text-white' : 'bg-cream-100 text-ink-muted'}"
				aria-hidden="true"
			>
				{#if status === 'connected' || status === 'sending'}
					<span class="relative flex h-3 w-3">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70"
						></span>
						<span class="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
					</span>
				{:else}
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><path
							d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3z"
							stroke-linecap="round"
							stroke-linejoin="round"
						/><path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke-linecap="round" stroke-linejoin="round" /></svg
					>
				{/if}
			</span>
			<div>
				<p class="text-sm font-bold text-ink">
					{#if status === 'connecting'}
						Connecting…
					{:else if status === 'connected'}
						{muted ? 'Microphone muted' : 'Live — just start talking'}
					{:else if status === 'sending'}
						Coach is responding…
					{:else if status === 'disconnecting'}
						Ending conversation…
					{:else if status === 'disconnected'}
						Conversation ended
					{:else if status === 'error'}
						Connection error
					{:else}
						Not connected
					{/if}
				</p>
				<p class="text-xs text-ink-soft">No recording button needed — the coach listens continuously.</p>
			</div>
		</div>

		{#if status === 'connected' || status === 'sending'}
			<div class="flex shrink-0 gap-2">
				<button
					type="button"
					class="rounded-full bg-cream-100 px-3 py-2 text-xs font-bold text-ink transition hover:bg-cream-200"
					onclick={() => setMuted(!muted)}
				>
					{muted ? 'Unmute' : 'Mute'}
				</button>
				<button
					type="button"
					class="rounded-full bg-ink px-3 py-2 text-xs font-bold text-white transition hover:bg-brand"
					onclick={disconnect}
				>
					End conversation
				</button>
			</div>
		{:else if status === 'disconnecting'}
			<span class="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-soft">Cleaning up…</span>
		{/if}
	</div>
</section>
