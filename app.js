'use strict';

const Homey = require('homey');

const BlueskySessionService = require('./lib/BlueskySessionService');

module.exports = class BlueskyApp extends Homey.App {

  async onInit() {
    this.bluesky = new BlueskySessionService({ homey: this.homey });
    this._registerFlowCards();
    this._registerConditionCards();
    this._registerDeviceTriggers();

    this.log('Bluesky app has been initialized');
  }

  _registerFlowCards() {
    const createPostCard = this.homey.flow.getActionCard('create_post');
    createPostCard.registerRunListener(async ({ device, text }) => {
      await device.createPost(text);
      return true;
    });

    const quoteCard = this.homey.flow.getActionCard('create_quote_post');
    quoteCard.registerRunListener(async (args) => {
      const { device, text } = args;
      await device.createQuotePost(text, args.post_uri);
      return true;
    });

    const repostCard = this.homey.flow.getActionCard('repost_post');
    repostCard.registerRunListener(async (args) => {
      await args.device.repost(args.post_uri);
      return true;
    });

    const unrepostCard = this.homey.flow.getActionCard('undo_repost');
    unrepostCard.registerRunListener(async (args) => {
      await args.device.unrepost(args.post_uri);
      return true;
    });

    const likeCard = this.homey.flow.getActionCard('like_post');
    likeCard.registerRunListener(async (args) => {
      await args.device.like(args.post_uri);
      return true;
    });

    const unlikeCard = this.homey.flow.getActionCard('unlike_post');
    unlikeCard.registerRunListener(async (args) => {
      await args.device.unlike(args.post_uri);
      return true;
    });

    const deletePostCard = this.homey.flow.getActionCard('delete_post');
    deletePostCard.registerRunListener(async (args) => {
      await args.device.deletePost(args.post_uri);
      return true;
    });

    const followCard = this.homey.flow.getActionCard('follow_user');
    followCard.registerRunListener(async (args) => {
      await args.device.followActor(args.actor);
      return true;
    });

    const unfollowCard = this.homey.flow.getActionCard('unfollow_user');
    unfollowCard.registerRunListener(async (args) => {
      await args.device.unfollowActor(args.actor);
      return true;
    });

    const muteCard = this.homey.flow.getActionCard('mute_user');
    muteCard.registerRunListener(async (args) => {
      await args.device.muteActor(args.actor);
      return true;
    });

    const unmuteCard = this.homey.flow.getActionCard('unmute_user');
    unmuteCard.registerRunListener(async (args) => {
      await args.device.unmuteActor(args.actor);
      return true;
    });

    const blockCard = this.homey.flow.getActionCard('block_user');
    blockCard.registerRunListener(async (args) => {
      await args.device.blockActor(args.actor);
      return true;
    });

    const unblockCard = this.homey.flow.getActionCard('unblock_user');
    unblockCard.registerRunListener(async (args) => {
      await args.device.unblockActor(args.actor);
      return true;
    });
  }

  _registerConditionCards() {
    const followedCard = this.homey.flow.getConditionCard('is_user_followed');
    followedCard.registerRunListener(async (args) => {
      return args.device.isUserFollowed(args.actor);
    });

    const mutedCard = this.homey.flow.getConditionCard('is_user_muted');
    mutedCard.registerRunListener(async (args) => {
      return args.device.isUserMuted(args.actor);
    });

    const blockedCard = this.homey.flow.getConditionCard('is_user_blocked');
    blockedCard.registerRunListener(async (args) => {
      return args.device.isUserBlocked(args.actor);
    });

    const followedByCard = this.homey.flow.getConditionCard('is_followed_by_user');
    followedByCard.registerRunListener(async (args) => {
      return args.device.isFollowedByUser(args.actor);
    });

    const followerCountCard = this.homey.flow.getConditionCard('follower_count_above');
    followerCountCard.registerRunListener(async (args) => {
      return args.device.isFollowerCountAbove(args.actor, args.threshold);
    });

    const postCountCard = this.homey.flow.getConditionCard('post_engagement_above');
    postCountCard.registerRunListener(async (args) => {
      return args.device.isPostEngagementAbove(args.post_uri, args.metric, args.threshold);
    });

    const unreadNotificationsCard = this.homey.flow.getConditionCard('has_unread_notifications');
    unreadNotificationsCard.registerRunListener(async (args) => {
      return args.device.hasUnreadNotifications();
    });
  }

  _registerDeviceTriggers() {
    this.newMentionTrigger = this.homey.flow.getDeviceTriggerCard('new_mention');
    this.newFollowerTrigger = this.homey.flow.getDeviceTriggerCard('new_follower');
    this.newNotificationTrigger = this.homey.flow.getDeviceTriggerCard('new_notification');
    this.newReplyTrigger = this.homey.flow.getDeviceTriggerCard('new_reply_to_my_post');
    this.newLikeTrigger = this.homey.flow.getDeviceTriggerCard('new_like_on_my_post');
    this.newRepostTrigger = this.homey.flow.getDeviceTriggerCard('new_repost_of_my_post');
    this.newQuoteTrigger = this.homey.flow.getDeviceTriggerCard('new_quote_of_my_post');
  }

  async handleDeviceUpdates(device, updates) {
    await device.applyAccountState(updates.next);

    const previousNotifications = updates.previous?.notifications?.items || [];
    const nextNotifications = updates.next?.notifications?.items || [];
    const previousUris = new Set(previousNotifications.map((notification) => notification.uri));

    for (const notification of nextNotifications) {
      if (previousUris.has(notification.uri)) continue;

      await this.newNotificationTrigger.trigger(device, {
        user_handle: notification.author.handle || '',
        user_name: notification.author.displayName || '',
        user_did: notification.author.did || '',
        reason: notification.reason || '',
        text: notification.text || '',
        post_uri: notification.uri || '',
      });

      if (notification.reason === 'mention') {
        await this.newMentionTrigger.trigger(device, {
          user_handle: notification.author.handle || '',
          user_name: notification.author.displayName || '',
          user_did: notification.author.did || '',
          text: notification.text || '',
          post_uri: notification.uri || '',
        });
      }

      if (notification.reason === 'reply') {
        await this.newReplyTrigger.trigger(device, {
          user_handle: notification.author.handle || '',
          user_name: notification.author.displayName || '',
          user_did: notification.author.did || '',
          text: notification.text || '',
          post_uri: notification.uri || '',
        });
      }

      if (notification.reason === 'like') {
        await this.newLikeTrigger.trigger(device, {
          user_handle: notification.author.handle || '',
          user_name: notification.author.displayName || '',
          user_did: notification.author.did || '',
          post_uri: notification.uri || '',
        });
      }

      if (notification.reason === 'repost') {
        await this.newRepostTrigger.trigger(device, {
          user_handle: notification.author.handle || '',
          user_name: notification.author.displayName || '',
          user_did: notification.author.did || '',
          post_uri: notification.uri || '',
        });
      }

      if (notification.reason === 'quote') {
        await this.newQuoteTrigger.trigger(device, {
          user_handle: notification.author.handle || '',
          user_name: notification.author.displayName || '',
          user_did: notification.author.did || '',
          text: notification.text || '',
          post_uri: notification.uri || '',
        });
      }

      if (notification.reason === 'follow') {
        await this.newFollowerTrigger.trigger(device, {
          user_handle: notification.author.handle || '',
          user_name: notification.author.displayName || '',
          user_did: notification.author.did || '',
        });
      }
    }
  }

};
