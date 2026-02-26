import WaveSurfer from 'wavesurfer.js';

export interface WaveSurferPlayerConfig {
  container: HTMLElement;
  audioUrl: string;
  isDarkTheme: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  /** Called when audio fails to load (expired URL, network error). Return a fresh URL to retry. */
  getRefreshUrl?: () => Promise<string>;
  /** Optional metadata for the Media Session API (OS media controls). */
  mediaMetadata?: {
    title: string;
    artist?: string;
  };
}

export interface WaveSurferPlayerInstance {
  ws: WaveSurfer;
  el: HTMLElement;
  destroy: () => void;
  /** Reload the player with a fresh URL (e.g. after presigned URL expiry). */
  loadUrl: (newUrl: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function createWaveSurferPlayer(config: WaveSurferPlayerConfig): WaveSurferPlayerInstance {
  const { container, audioUrl, isDarkTheme, onPlay, onPause } = config;

  // Colors
  const waveColor = isDarkTheme ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.20)';
  const progressColor = isDarkTheme ? '#90caf9' : '#1976d2';
  const cursorColor = isDarkTheme ? '#90caf9' : '#1976d2';

  // Build DOM structure
  const wrapper = document.createElement('div');
  wrapper.className = 'ws-player';

  const waveformDiv = document.createElement('div');
  waveformDiv.className = 'ws-waveform';
  wrapper.appendChild(waveformDiv);

  // Skeleton equalizer loader
  const skeleton = document.createElement('div');
  skeleton.className = 'ws-skeleton';
  for (let i = 0; i < 5; i++) {
    skeleton.appendChild(document.createElement('span'));
  }
  waveformDiv.appendChild(skeleton);

  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'ws-controls';

  // Play/pause button
  const playBtn = document.createElement('button');
  playBtn.className = 'ws-play-btn';
  playBtn.type = 'button';
  const playIcon = document.createElement('span');
  playIcon.className = 'material-icons';
  playIcon.textContent = 'play_arrow';
  playBtn.appendChild(playIcon);

  // Time display
  const timeCurrent = document.createElement('span');
  timeCurrent.className = 'ws-time-current';
  timeCurrent.textContent = '0:00';

  const timeSeparator = document.createElement('span');
  timeSeparator.className = 'ws-time-separator';
  timeSeparator.textContent = '/';

  const timeTotal = document.createElement('span');
  timeTotal.className = 'ws-time-total';
  timeTotal.textContent = '0:00';

  // Spacer
  const spacer = document.createElement('span');
  spacer.className = 'ws-spacer';

  // Mute button
  const muteBtn = document.createElement('button');
  muteBtn.className = 'ws-mute-btn';
  muteBtn.type = 'button';
  const muteIcon = document.createElement('span');
  muteIcon.className = 'material-icons';
  muteIcon.textContent = 'volume_up';
  muteBtn.appendChild(muteIcon);

  controlsDiv.appendChild(playBtn);
  controlsDiv.appendChild(timeCurrent);
  controlsDiv.appendChild(timeSeparator);
  controlsDiv.appendChild(timeTotal);
  controlsDiv.appendChild(spacer);
  controlsDiv.appendChild(muteBtn);
  wrapper.appendChild(controlsDiv);

  container.appendChild(wrapper);

  // Create WaveSurfer instance
  const ws = WaveSurfer.create({
    container: waveformDiv,
    url: audioUrl,
    height: 32,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    cursorWidth: 1,
    normalize: true,
    hideScrollbar: true,
    interact: true,
    autoplay: false,
    waveColor,
    progressColor,
    cursorColor,
  });

  // Error overlay (shown when audio fetch fails — e.g. expired presigned URL)
  let errorOverlay: HTMLDivElement | null = null;

  function showErrorOverlay() {
    if (errorOverlay) return;
    errorOverlay = document.createElement('div');
    errorOverlay.className = 'ws-error-overlay';

    const icon = document.createElement('span');
    icon.className = 'material-icons ws-error-icon';
    icon.textContent = 'cloud_off';
    errorOverlay.appendChild(icon);

    if (config.getRefreshUrl) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'ws-retry-btn';
      retryBtn.type = 'button';
      const retryIcon = document.createElement('span');
      retryIcon.className = 'material-icons';
      retryIcon.textContent = 'refresh';
      retryBtn.appendChild(retryIcon);

      retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        retryIcon.textContent = 'sync';
        retryIcon.classList.add('ws-spin');
        try {
          const freshUrl = await config.getRefreshUrl!();
          instance.loadUrl(freshUrl);
        } catch {
          retryBtn.disabled = false;
          retryIcon.textContent = 'refresh';
          retryIcon.classList.remove('ws-spin');
        }
      });
      errorOverlay.appendChild(retryBtn);
    }

    waveformDiv.appendChild(errorOverlay);
  }

  function hideErrorOverlay() {
    errorOverlay?.remove();
    errorOverlay = null;
  }

  // Event wiring
  let isMuted = false;

  // Register Media Session action handlers once (play/pause mapped to wavesurfer)
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => ws.play());
    navigator.mediaSession.setActionHandler('pause', () => ws.pause());
    navigator.mediaSession.setActionHandler('stop', () => {
      ws.stop();
      onPause?.();
    });
  }

  ws.on('play', () => {
    playIcon.textContent = 'pause';
    if (config.mediaMetadata && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: config.mediaMetadata.title,
        artist: config.mediaMetadata.artist ?? 'Ecnelis FLY',
        album: 'Ecnelis FLY',
        artwork: [
          { src: '/img/logos/logo_blue_orange_left_round.png', sizes: '512x512', type: 'image/png' },
        ],
      });
      navigator.mediaSession.playbackState = 'playing';
    }
    onPlay?.();
  });

  ws.on('pause', () => {
    playIcon.textContent = 'play_arrow';
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
    onPause?.();
  });

  ws.on('finish', () => {
    playIcon.textContent = 'play_arrow';
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
    onPause?.();
  });

  ws.on('timeupdate', (currentTime: number) => {
    timeCurrent.textContent = formatTime(currentTime);
  });

  ws.on('decode', (duration: number) => {
    timeTotal.textContent = formatTime(duration);
  });

  ws.on('ready', () => {
    skeleton.classList.add('ws-skeleton-out');
    setTimeout(() => skeleton.remove(), 400);
  });

  ws.on('error', () => {
    if (ws.isPlaying()) onPause?.();
    showErrorOverlay();
  });

  // Play/Pause click
  playBtn.addEventListener('click', () => {
    ws.playPause();
  });

  // Mute click
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    ws.setMuted(isMuted);
    muteIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
  });

  const instance: WaveSurferPlayerInstance = {
    ws,
    el: wrapper,
    loadUrl: (newUrl: string) => {
      hideErrorOverlay();
      // Re-add skeleton for loading state
      const reloadSkeleton = document.createElement('div');
      reloadSkeleton.className = 'ws-skeleton';
      for (let i = 0; i < 5; i++) {
        reloadSkeleton.appendChild(document.createElement('span'));
      }
      waveformDiv.prepend(reloadSkeleton);
      ws.once('ready', () => {
        reloadSkeleton.classList.add('ws-skeleton-out');
        setTimeout(() => reloadSkeleton.remove(), 400);
      });
      ws.load(newUrl);
    },
    destroy: () => {
      if (ws.isPlaying()) onPause?.();
      ws.destroy();
    },
  };

  return instance;
}
