import WaveSurfer from 'wavesurfer.js';

export interface WaveSurferPlayerConfig {
  container: HTMLElement;
  audioUrl: string;
  isDarkTheme: boolean;
  onPlay?: () => void;
  onPause?: () => void;
}

export interface WaveSurferPlayerInstance {
  ws: WaveSurfer;
  el: HTMLElement;
  destroy: () => void;
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

  // Event wiring
  let isMuted = false;

  ws.on('play', () => {
    playIcon.textContent = 'pause';
    onPlay?.();
  });

  ws.on('pause', () => {
    playIcon.textContent = 'play_arrow';
    onPause?.();
  });

  ws.on('finish', () => {
    playIcon.textContent = 'play_arrow';
    onPause?.();
  });

  ws.on('timeupdate', (currentTime: number) => {
    timeCurrent.textContent = formatTime(currentTime);
  });

  ws.on('decode', (duration: number) => {
    timeTotal.textContent = formatTime(duration);
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

  return {
    ws,
    el: wrapper,
    destroy: () => {
      // Ensure ambient is unducked if playing
      if (ws.isPlaying()) {
        onPause?.();
      }
      ws.destroy();
    },
  };
}
