const EcoVoice = {
  API_KEY: 'Eleven Labs API',
  VOICE_ID: 'EXAVITQu4vr4xnSDxMaL',         // "Bella" — calm, warm
  _audio: null,
  _state: 'idle', // idle | loading | playing | paused

  isEnabled() {
    return this.API_KEY && this.API_KEY !== 'YOUR_ELEVENLABS_API_KEY_HERE';
  },

  async speak(text, button) {
    if (!this.isEnabled()) return;
    if (this._state === 'playing') { this._audio.pause(); this._state = 'paused'; this._updateBtn(button,'play'); return; }
    if (this._state === 'paused' && this._audio) { this._audio.play(); this._state = 'playing'; this._updateBtn(button,'pause'); return; }

    this._state = 'loading';
    this._updateBtn(button, 'loading');

    try {
      const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + this.VOICE_ID, {
        method: 'POST',
        headers: { 'xi-api-key': this.API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2',
          voice_settings: { stability: 0.7, similarity_boost: 0.8 }
        })
      });
      if (!res.ok) throw new Error('ElevenLabs ' + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      this._audio = new Audio(url);
      this._audio.onended = () => { this._state = 'idle'; this._updateBtn(button, 'play'); };
      this._audio.play();
      this._state = 'playing';
      this._updateBtn(button, 'pause');
    } catch (err) {
      console.error('[EcoAware Voice]', err);
      this._state = 'idle';
      this._updateBtn(button, 'error');
    }
  },

  _updateBtn(btn, state) {
    if (!btn) return;
    const icons = { play: '🔊', pause: '⏸', loading: '⏳', error: '❌' };
    btn.textContent = icons[state] || '🔊';
    btn.title = state === 'loading' ? 'Loading...' : state === 'pause' ? 'Pause' : 'Listen';
  }
};
