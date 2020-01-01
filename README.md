# discord.js-andesite

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/e9fe39139915430a812af57f87dad66e)](https://www.codacy.com/manual/LolWastedJS/discord.js-andesite?utm_source=github.com&utm_medium=referral&utm_content=LolWastedJS/discord.js-andesite&utm_campaign=Badge_Grade)
[![npm](https://img.shields.io/npm/dt/discord.js-andesite?color=red&label=Total%20Downloads&logo=npm&style=flat-square)](https://npmjs.com/discord.js-andesite)
[![dependencies Status](https://david-dm.org/lolwastedjs/discord.js-andesite/status.svg)](https://david-dm.org/lolwastedjs/discord.js-andesite)
[![devDependencies Status](https://david-dm.org/lolwastedjs/discord.js-andesite/dev-status.svg)](https://david-dm.org/lolwastedjs/discord.js-andesite?type=dev)
[![Build Status](https://travis-ci.com/LolWastedJS/discord.js-andesite.svg?branch=master)](https://travis-ci.com/LolWastedJS/discord.js-andesite)

An [andesite-node](https://github.com/natanbc/andesite-node) client for [discord.js](https://npmjs.com/discord.js).

- 📦 has _most_ of the andesite features implemented.
- 💪 Strongly Typed.
- ⛓ Reliable and Straightforward.

[Support](https://discord.gg/kzaSTx) •
[Github](https://github.com/lolwastedjs/discord.js-andesite) •
[NPM](https://npmjs.com/discord.js-andesite) •
[Documentation](https://melike2d.ml/discord.js-andesite)

## Installation

- stable

  > `npm install discord.js-andesite`  
  > `yarn add discord.js-andesite`

- master (beta)
  > `npm install lolwastedjs/discord.js-andesite`  
  > `yarn add lolwastedjs/discord.js-andesite`

An andesite node via Github [Releases](https://github.com/natanbc/andesite-node/releases)

> **_WARNING: using the .jar from the official repository isn't a good idea due to the dependencies being very outdated... use my unofficial jar. (use the one with -all)_** <https://mega.nz/#!NvRgESSB!BXToxq1CVEztEk0knzh2L8ypLmcLiuEsJr8hLxpmE1s>

## Implementation

- Manager

```js
const { Manager } = require("discord.js-andesite");
const manager = new Manager(client, {
  nodes: [
    {
      host: "localhost",
      port: 5000,
      name: "main", // name of the node (used for fetching it)
      auth: "nicepassword" // you can omit this if you didn't set a password
    }
  ],
  defaultVolume: 50, // the default volume for players.
  restTimeout: 15000, // the timeout used for rest requests (default is 10000)
  player, // The player class to use, you should omit this if you don't know what you're doing.
  reconnectTries: 3 // the amount of tries to reconnect.
});
client.on("ready", async () => {
  await manager.init(client.user.id);
});
```

- Fetching Songs  
  Andesite automatically does `ytsearch:` if you have the option enabled in your `application.conf`.
  Manager#search returns the response of `/loadtracks` so check the andesite docs for reference.

```js
async function getSongs(query) {
  const results = await manager.search(query);
  return results.tracks;
}
```

- Joining and Leaving

```js
// joining
const node = manager.nodes.get(); // returns the ideal if no key is provided.
if (!node) throw new Error("No available nodes.");
const player = node.join({
  guildId: message.guild.id,
  channelId: message.member.voice.channelId
});
```

```js
// leaving
const node = manager.nodes.get(); // returns the ideal if no key is provided.
if (!node) throw new Error("No available nodes.");
node.leave(message.guild.id);
```

## Example

<https://github.com/lolwastedjs/erika-costell>

The example shows most of the features that this client and andesite supports.

- filters (timescale, equalizer)
- player methods & properties (play, pause, resume, setVolume, filter, stop, position, paused)
- search method
- rest manager

## Featured

> A list of bots that use this package.

- [Erika Costell](https://github.com/lolwastedjs/erika-costell) (example bot)
- [VorteKore](https://github.com/VorteKore)

[Add yours!](https://discord.gg/kzaSTx)

### Copyright Stuff

Copyright (c) MeLike2D 2017 - 2019.  
[Support](https://discord.gg/kzaSTx) • [Website](https://melike2d.me/)
