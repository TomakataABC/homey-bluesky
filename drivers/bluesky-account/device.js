'use strict';

const Homey = require('homey');

module.exports = class BlueskyAccountDevice extends Homey.Device {

  static get POLL_INTERVAL_MS() {
    return 60 * 1000;
  }

  async onInit() {
    this.log(`Bluesky account device initialized: ${this.getName()}`);
    await this._ensureCapabilities();
    await this.refreshAccountState();

    this._pollInterval = this.homey.setInterval(async () => {
      try {
        await this.refreshAccountState();
      } catch (error) {
        this.error('Failed to poll Bluesky account state', error);
      }
    }, this.constructor.POLL_INTERVAL_MS);
  }

  _getBlueskyService() {
    return this.homey.app.bluesky;
  }

  async _ensureCapabilities() {
    const capabilities = [
      'measure_followers',
      'measure_following',
      'measure_posts',
      'measure_unread_notifications',
    ];

    for (const capability of capabilities) {
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability);
      }
    }
  }

  _getMetricValue(state, metric) {
    switch (String(metric || '').toLowerCase()) {
      case 'likes': return state?.likeCount || 0;
      case 'reposts': return state?.repostCount || 0;
      case 'replies': return state?.replyCount || 0;
      default: return 0;
    }
  }

  async applyAccountState(state) {
    if (!state || !state.profile) {
      return;
    }

    await this.setCapabilityValue('measure_followers', state.profile.followersCount || 0);
    await this.setCapabilityValue('measure_following', state.profile.followsCount || 0);
    await this.setCapabilityValue('measure_posts', state.profile.postsCount || 0);
    await this.setCapabilityValue('measure_unread_notifications', state.notifications?.unreadCount || 0);

    await this.setSettings({
      display_name: state.profile.displayName || '',
      handle: state.profile.handle || '',
      did: state.profile.did || '',
    });
  }

  async refreshAccountState() {
    const updates = await this._getBlueskyService().checkForUpdates(this.getData().id);
    await this.homey.app.handleDeviceUpdates(this, updates);
    return updates.next;
  }

  async createPost(text) {
    return this._getBlueskyService().createPost({
      did: this.getData().id,
      text,
    });
  }

  async createReply(text, parentUri, rootUri) {
    return this._getBlueskyService().createReply({
      did: this.getData().id,
      text,
      parentUri,
      rootUri,
    });
  }

  async createQuotePost(text, quotedUri) {
    return this._getBlueskyService().createQuotePost({
      did: this.getData().id,
      text,
      quotedUri,
    });
  }

  async repost(postUri) {
    return this._getBlueskyService().repost({
      did: this.getData().id,
      postUri,
    });
  }

  async unrepost(repostUri) {
    return this._getBlueskyService().unrepost({
      did: this.getData().id,
      repostUri,
    });
  }

  async like(postUri) {
    return this._getBlueskyService().like({
      did: this.getData().id,
      postUri,
    });
  }

  async unlike(likeUri) {
    return this._getBlueskyService().unlike({
      did: this.getData().id,
      likeUri,
    });
  }

  async deletePost(postUri) {
    return this._getBlueskyService().deletePost({
      did: this.getData().id,
      postUri,
    });
  }

  async followActor(actor) {
    return this._getBlueskyService().followActor({
      did: this.getData().id,
      actor,
    });
  }

  async unfollowActor(actor) {
    return this._getBlueskyService().unfollowActor({
      did: this.getData().id,
      actor,
    });
  }

  async muteActor(actor) {
    return this._getBlueskyService().muteActor({
      did: this.getData().id,
      actor,
    });
  }

  async unmuteActor(actor) {
    return this._getBlueskyService().unmuteActor({
      did: this.getData().id,
      actor,
    });
  }

  async blockActor(actor) {
    return this._getBlueskyService().blockActor({
      did: this.getData().id,
      actor,
    });
  }

  async unblockActor(actor) {
    return this._getBlueskyService().unblockActor({
      did: this.getData().id,
      actor,
    });
  }

  async isUserFollowed(actor) {
    return this._getBlueskyService().isUserFollowed({
      did: this.getData().id,
      actor,
    });
  }

  async isUserMuted(actor) {
    return this._getBlueskyService().isUserMuted({
      did: this.getData().id,
      actor,
    });
  }

  async isUserBlocked(actor) {
    return this._getBlueskyService().isUserBlocked({
      did: this.getData().id,
      actor,
    });
  }

  async isFollowedByUser(actor) {
    return this._getBlueskyService().isFollowedByUser({
      did: this.getData().id,
      actor,
    });
  }

  async hasUnreadNotifications() {
    const state = await this.refreshAccountState();
    return (state.notifications?.unreadCount || 0) > 0;
  }

  async onAdded() {
    await this.refreshAccountState();
  }

  async onSettings() {
    await this.refreshAccountState();
    return true;
  }

  async onUninit() {
    if (this._pollInterval) {
      this.homey.clearInterval(this._pollInterval);
    }
  }

  async onDeleted() {
    await this._getBlueskyService().deleteSession(this.getData().id);
  }

};
