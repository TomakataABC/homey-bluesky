'use strict';

const { AtpAgent } = require('@atproto/api');

const HomeyJsonStore = require('./HomeyJsonStore');

class BlueskySessionService {

  constructor({ homey }) {
    this.homey = homey;
    this.sessionStore = new HomeyJsonStore({
      homey: this.homey,
      settingsKey: 'bluesky.sessions',
    });
  }

  _normalizeServiceUrl() {
    const input = 'https://bsky.social';
    const normalized = input.startsWith('http://') || input.startsWith('https://')
      ? input
      : `https://${input}`;

    return new URL(normalized).toString().replace(/\/$/, '');
  }

  _createAgent({ service, sessionKey }) {
    return new AtpAgent({
      service,
      persistSession: async (event, session) => {
        if (event === 'expired' || !session) {
          await this.sessionStore.del(sessionKey);
          return;
        }

        const existing = await this.sessionStore.get(sessionKey) || {};
        await this.sessionStore.set(sessionKey, {
          service: existing.service || service,
          session,
        });
      },
    });
  }

  async login({ identifier, password }) {
    const handle = String(identifier || '').trim();
    const appPassword = String(password || '').trim();

    if (!handle) {
      throw new Error(this.homey.__('errors.missing_handle'));
    }

    if (!appPassword) {
      throw new Error(this.homey.__('errors.missing_app_password'));
    }

    const serviceUrl = this._normalizeServiceUrl();
    const agent = this._createAgent({
      service: serviceUrl,
      sessionKey: handle,
    });

    await agent.login({
      identifier: handle,
      password: appPassword,
    });

    if (!agent.session?.did) {
      throw new Error(this.homey.__('errors.login_failed'));
    }

    const { did } = agent.session;
    const savedSession = await this.sessionStore.get(handle);
    if (savedSession) {
      await this.sessionStore.set(did, savedSession);
      await this.sessionStore.del(handle);
    }

    return this.getAccount(did);
  }

  async getAccount(did) {
    const stored = await this.sessionStore.get(did);
    if (!stored?.session) {
      throw new Error(this.homey.__('errors.session_missing'));
    }

    const agent = this._createAgent({
      service: stored.service,
      sessionKey: did,
    });
    await agent.resumeSession(stored.session);

    const profile = await agent.getProfile({ actor: did }).catch(() => null);
    const handle = profile?.data?.handle || agent.session?.handle || did;
    const displayName = profile?.data?.displayName || null;
    const name = displayName ? `${displayName} (@${handle})` : `@${handle}`;

    return {
      id: did,
      did,
      handle,
      displayName,
      service: stored.service,
      serviceEndpoint: agent.pdsUrl ? agent.pdsUrl.toString() : stored.service,
      name,
    };
  }

  async createPost({ did, text }) {
    const postText = String(text || '').trim();
    if (!postText) {
      throw new Error(this.homey.__('errors.post_text_required'));
    }

    const stored = await this.sessionStore.get(did);
    if (!stored?.session) {
      throw new Error(this.homey.__('errors.session_missing'));
    }

    const agent = this._createAgent({
      service: stored.service,
      sessionKey: did,
    });
    await agent.resumeSession(stored.session);

    return agent.post({
      $type: 'app.bsky.feed.post',
      text: postText,
      createdAt: new Date().toISOString(),
    });
  }

  async deleteSession(did) {
    await this.sessionStore.del(did);
  }

}

module.exports = BlueskySessionService;
