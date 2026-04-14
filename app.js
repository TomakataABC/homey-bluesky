'use strict';

const Homey = require('homey');

const BlueskySessionService = require('./lib/BlueskySessionService');

module.exports = class BlueskyApp extends Homey.App {

  async onInit() {
    this.bluesky = new BlueskySessionService({ homey: this.homey });

    const createPostCard = this.homey.flow.getActionCard('create_post');
    createPostCard.registerRunListener(async ({ device, text }) => {
      await device.createPost(text);
      return true;
    });

    this.log('Bluesky app has been initialized');
  }

};
