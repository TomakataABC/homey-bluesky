'use strict';

const { AtpAgent, RichText } = require('@atproto/api');

const HomeyJsonStore = require('./HomeyJsonStore');

class BlueskySessionService {

  constructor({ homey }) {
    this.homey = homey;
    this.sessionStore = new HomeyJsonStore({
      homey: this.homey,
      settingsKey: 'bluesky.sessions',
    });
    this.stateStore = new HomeyJsonStore({
      homey: this.homey,
      settingsKey: 'bluesky.account-state',
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

  async _getStoredSession(did) {
    const stored = await this.sessionStore.get(did);
    if (!stored || !stored.session) {
      throw new Error(this.homey.__('errors.session_missing'));
    }

    return stored;
  }

  async _getAgentForDid(did) {
    const stored = await this._getStoredSession(did);
    const agent = this._createAgent({
      service: stored.service,
      sessionKey: did,
    });
    await agent.resumeSession(stored.session);

    return {
      agent,
      stored,
    };
  }

  async _getPostView(agent, uri) {
    const response = await agent.getPosts({ uris: [uri] });
    return response.data.posts[0] || null;
  }

  _extractCounters(postView) {
    return {
      likeCount: postView?.likeCount || 0,
      repostCount: postView?.repostCount || 0,
      replyCount: postView?.replyCount || 0,
      quoteCount: postView?.quoteCount || 0,
    };
  }

  _extractText(postView) {
    return postView?.record?.text || '';
  }

  _extractTimestamp(postView) {
    return postView?.record?.createdAt || null;
  }

  async _resolvePostRef(agent, uri) {
    const postView = await this._getPostView(agent, uri);
    if (!postView) {
      throw new Error(this.homey.__('errors.post_not_found'));
    }

    return {
      postView,
      ref: {
        uri: postView.uri,
        cid: postView.cid,
      },
    };
  }

  async _buildRichText(agent, text) {
    const richText = new RichText({
      text: String(text || '').trim(),
    });

    await richText.detectFacets(agent);

    return richText;
  }

  async _resolveActor(agent, actor) {
    const profile = await agent.getProfile({ actor });
    return profile.data;
  }

  async _getRelationshipState(agent, actor) {
    const resolved = await this._resolveActor(agent, actor);
    const relationships = await agent.app.bsky.graph.getRelationships({
      actor: agent.session.did,
      others: [resolved.did],
    });
    const relationship = relationships.data.relationships[0] || {};

    return {
      actor: resolved,
      relationship,
    };
  }

  async _refreshAccountState(did) {
    const account = await this.getAccount(did);
    const { agent } = await this._getAgentForDid(did);
    const unread = await agent.app.bsky.notification.getUnreadCount();
    const notificationsResponse = await agent.listNotifications({ limit: 10 });
    const authorFeedResponse = await agent.getAuthorFeed({ actor: did, limit: 1 });
    const latestFeedItem = authorFeedResponse.data.feed[0] || null;
    const latestPost = latestFeedItem ? latestFeedItem.post : null;

    const state = {
      profile: {
        did: account.did,
        handle: account.handle,
        displayName: account.displayName,
        avatar: account.avatar,
        followersCount: account.followersCount,
        followsCount: account.followsCount,
        postsCount: account.postsCount,
        viewer: account.viewer,
      },
      notifications: {
        unreadCount: unread.data.count || 0,
        items: (notificationsResponse.data.notifications || []).map((notification) => ({
          uri: notification.uri,
          cid: notification.cid,
          reason: notification.reason,
          indexedAt: notification.indexedAt,
          author: {
            did: notification.author?.did,
            handle: notification.author?.handle,
            displayName: notification.author?.displayName,
            avatar: notification.author?.avatar,
          },
          isRead: Boolean(notification.isRead),
          text: notification.record?.text || '',
        })),
      },
      latestPost: latestPost ? {
        uri: latestPost.uri,
        cid: latestPost.cid,
        text: this._extractText(latestPost),
        createdAt: this._extractTimestamp(latestPost),
        author: {
          handle: latestPost.author?.handle,
          displayName: latestPost.author?.displayName,
          avatar: latestPost.author?.avatar,
        },
        likeCount: this._extractCounters(latestPost).likeCount,
        repostCount: this._extractCounters(latestPost).repostCount,
        replyCount: this._extractCounters(latestPost).replyCount,
        quoteCount: this._extractCounters(latestPost).quoteCount,
      } : null,
    };

    await this.stateStore.set(did, state);
    return state;
  }

  async syncAccountState(did) {
    return this._refreshAccountState(did);
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
    const { agent, stored } = await this._getAgentForDid(did);

    const profile = await agent.getProfile({ actor: did }).catch(() => null);
    const handle = profile?.data?.handle || agent.session?.handle || did;
    const displayName = profile?.data?.displayName || null;
    const name = displayName ? `${displayName} (@${handle})` : `@${handle}`;

    return {
      id: did,
      did,
      handle,
      displayName,
      avatar: profile?.data?.avatar || null,
      followersCount: profile?.data?.followersCount || 0,
      followsCount: profile?.data?.followsCount || 0,
      postsCount: profile?.data?.postsCount || 0,
      viewer: profile?.data?.viewer || {},
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

    const { agent } = await this._getAgentForDid(did);
    const richText = await this._buildRichText(agent, postText);

    return agent.post({
      $type: 'app.bsky.feed.post',
      text: richText.text,
      facets: richText.facets,
      createdAt: new Date().toISOString(),
    });
  }

  async createReply({
    did,
    text,
    parentUri,
    rootUri,
  }) {
    const replyText = String(text || '').trim();
    if (!replyText) {
      throw new Error(this.homey.__('errors.post_text_required'));
    }

    const { agent } = await this._getAgentForDid(did);
    const richText = await this._buildRichText(agent, replyText);
    const parent = await this._resolvePostRef(agent, parentUri);
    const root = rootUri ? await this._resolvePostRef(agent, rootUri) : parent;

    return agent.post({
      text: richText.text,
      facets: richText.facets,
      createdAt: new Date().toISOString(),
      reply: {
        root: root.ref,
        parent: parent.ref,
      },
    });
  }

  async createQuotePost({ did, text, quotedUri }) {
    const quoteText = String(text || '').trim();
    if (!quoteText) {
      throw new Error(this.homey.__('errors.post_text_required'));
    }

    const { agent } = await this._getAgentForDid(did);
    const richText = await this._buildRichText(agent, quoteText);
    const quoted = await this._resolvePostRef(agent, quotedUri);

    return agent.post({
      text: richText.text,
      facets: richText.facets,
      createdAt: new Date().toISOString(),
      embed: {
        $type: 'app.bsky.embed.record',
        record: quoted.ref,
      },
    });
  }

  async repost({ did, postUri }) {
    const { agent } = await this._getAgentForDid(did);
    const post = await this._resolvePostRef(agent, postUri);
    return agent.repost(post.ref.uri, post.ref.cid);
  }

  async unrepost({ did, repostUri }) {
    const { agent } = await this._getAgentForDid(did);
    return agent.deleteRepost(repostUri);
  }

  async like({ did, postUri }) {
    const { agent } = await this._getAgentForDid(did);
    const post = await this._resolvePostRef(agent, postUri);
    return agent.like(post.ref.uri, post.ref.cid);
  }

  async unlike({ did, likeUri }) {
    const { agent } = await this._getAgentForDid(did);
    return agent.deleteLike(likeUri);
  }

  async deletePost({ did, postUri }) {
    const { agent } = await this._getAgentForDid(did);
    return agent.deletePost(postUri);
  }

  async followActor({ did, actor }) {
    const { agent } = await this._getAgentForDid(did);
    const resolved = await this._resolveActor(agent, actor);
    return agent.app.bsky.graph.follow.create(
      {
        repo: did,
      },
      {
        subject: resolved.did,
        createdAt: new Date().toISOString(),
      },
    );
  }

  async unfollowActor({ did, actor }) {
    const { agent } = await this._getAgentForDid(did);
    const state = await this._getRelationshipState(agent, actor);
    if (!state.relationship.following) {
      return false;
    }

    const rkey = state.relationship.following.split('/').pop();
    return agent.app.bsky.graph.follow.delete({
      repo: did,
      rkey,
    });
  }

  async muteActor({ did, actor }) {
    const { agent } = await this._getAgentForDid(did);
    const resolved = await this._resolveActor(agent, actor);
    return agent.mute(resolved.did);
  }

  async unmuteActor({ did, actor }) {
    const { agent } = await this._getAgentForDid(did);
    const resolved = await this._resolveActor(agent, actor);
    return agent.unmute(resolved.did);
  }

  async blockActor({ did, actor }) {
    const { agent } = await this._getAgentForDid(did);
    const resolved = await this._resolveActor(agent, actor);
    return agent.app.bsky.graph.block.create(
      {
        repo: did,
      },
      {
        subject: resolved.did,
        createdAt: new Date().toISOString(),
      },
    );
  }

  async unblockActor({ did, actor }) {
    const { agent } = await this._getAgentForDid(did);
    const state = await this._getRelationshipState(agent, actor);
    if (!state.relationship.blocking) {
      return false;
    }

    const rkey = state.relationship.blocking.split('/').pop();
    return agent.app.bsky.graph.block.delete({
      repo: did,
      rkey,
    });
  }

  async isUserFollowed({ did, actor }) {
    const { agent } = await this._getAgentForDid(did);
    const state = await this._getRelationshipState(agent, actor);
    return Boolean(state.relationship.following);
  }

  async doesProfileMatch({ did, value }) {
    const account = await this.getAccount(did);
    const needle = String(value || '').trim().toLowerCase();
    if (!needle) {
      return false;
    }

    const handle = String(account.handle || '').toLowerCase();
    const displayName = String(account.displayName || '').toLowerCase();
    return handle === needle || displayName === needle;
  }

  async getWidgetProfileSummary({ deviceId }) {
    const state = await this._refreshAccountState(deviceId);
    return state.profile;
  }

  async getWidgetUnreadNotifications({ deviceId, limit = 5 }) {
    const state = await this._refreshAccountState(deviceId);
    return {
      unreadCount: state.notifications.unreadCount,
      items: state.notifications.items.slice(0, limit),
    };
  }

  async getWidgetLatestPost({ deviceId }) {
    const state = await this._refreshAccountState(deviceId);
    return state.latestPost;
  }

  async checkForUpdates(did) {
    const previous = await this.stateStore.get(did) || null;
    const next = await this._refreshAccountState(did);

    return {
      previous,
      next,
    };
  }

  async deleteSession(did) {
    await this.sessionStore.del(did);
    await this.stateStore.del(did);
  }

}

module.exports = BlueskySessionService;
