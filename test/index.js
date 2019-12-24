/*
 * Copyright (c) MeLike2D 2017 - 2019.
 * All Rights Reserved.
 */

const { Manager } = require("../build");
const { Client, MessageEmbed } = require("discord.js");

const queues = {};
const client = new Client();
const manager = new Manager(client, {
  nodes: [{
    host: "localhost",
    port: 5000,
    name: "main node",
    auth: "youshall"
  }],
  defaultVolume: 50,
  send(guildId, packet) {
    const guild = client.guilds.get(guildId);
    if (!guild) return;
    console.log(packet);
    return guild.shard.send(packet);
  }
});

let s = m => new MessageEmbed().setColor("RED").setDescription(m);

client.on("ready", async () => {
  console.log("ready");

  await manager.init(client.user.id);
  manager.on("open", name => console.info(`Node ${name} is now connected`));
  manager.on("error", console.error);
});

client.on("message", async (message) => {
  if (message.channel.type === "dm") return;
  if (message.author.bot) return;
  if (!message.content.startsWith("i>")) return;

  const [cmd, ...args] = message.content.slice(2).trim().split(/ +/g);

  const node = manager.nodes.get();
  if (!node) return message.channel.send(s("Sorry, no nodes are currently available.  "));

  switch (cmd.toLowerCase()) {
    case "moveTo": {
      const player = node.players.get(message.guild.id);
      if (!player) return message.channel.send(s(`Use \`!>play <song name or url>\` to start a queue`));

      await player.moveVoiceChannel(args[0]);
      break;
    }

    case "play": {
      let player = node.players.get(message.guild.id);
      if (player && queues[message.guild.id]) {
        if (!message.member.voice.channel.members.has(client.user.id))
          return message.channel.send(s(`Please join the voice channel i'm in`));
      } else {
        queues[message.guild.id] = [];
        player = node.join({ guildId: message.guild.id, channelId: message.member.voice.channelID });
      }

      const results = await manager.search(args.join(" "), node);
      if (!queues[message.guild.id][0]) {
        player.on("end", async () => {
          queues[message.guild.id].shift();
          if (queues[message.guild.id][0]) {
            await player.play(queues[message.guild.id][0].track);
            return message.channel.send(s(`Playing **[${queues[message.guild.id][0].info.title}](${queues[message.guild.id][0].info.uri})**`));
          }
          delete queues[message.guild.id];
          await message.channel.send(s(`No more music left in the queue, leaving.`));
          return node.leave(message.guild.id);
        });
        queues[message.guild.id].push(results.tracks[0]);
        await player.play(results.tracks[0].track);
        return message.channel.send(s(`Playing **[${results.tracks[0].info.title}](${results.tracks[0].info.uri})** via request of **${message.author}**`));
      }

      queues[message.guild.id].push(results.tracks[0]);
      return message.channel.send(s(`Queued **[${results.tracks[0].info.title}](${results.tracks[0].info.uri})** via request of **${message.author}**`));
    }

    case "leave": {
      const player = node.players.get(message.guild.id);
      if (!player) return message.channel.send(s(`Use \`!>play <song name or url>\` to start a queue`));

      await node.leave(message.guild.id);
      return message.channel.send(s(`Left <#${player.channelId}> via request of **${message.member}**`));
    }

    case "nc":
    case "nightcore": {
      const player = node.players.get(message.guild.id);
      if (!player) return message.channel.send(s(`Use \`!>play <song name or url>\` to start a queue`));

      await player.filter("timescale", {
        pitch: 1,
        rate: args[0] !== "disable" ? 1.5 : 1
      });
      return message.channel.send(s(`${args[0] === "disable" ? "Disabled" : "Enabled"} the nightcore mode!\n*takes a few seconds to take affect*`));
    }

    case "np":
    case "nowplaying": {
      const player = node.players.get(message.guild.id);
      if (!player) return message.channel.send(s(`Use \`!>play <song name or url>\` to start a queue`));

      const current = await node.rest.get(`/decodetrack?track=${player.track}`);
      return message.channel.send(s(require('./util').playerEmbed(player, current)));
    }

    case "bb":
    case "bassboost": {
      const player = node.players.get(message.guild.id);
      if (!player) return message.channel.send(s(`Use \`!>play <song name or url>\` to start a queue`));

      let levels = {
        high: 0.25,
        medium: 0.15,
        low: 0.05,
        none: 0.00
      }, i = 0;

      if (levels[args[0]] === undefined)
        return message.channel.send(s(`Sorry, the available levels are ${Object.keys(levels).map((_, i, a) => `${i >= a.length ? " and " : ""}**${_}**`).join(", ")}`))

      await player.filter("equalizer", {
        bands: Array(3).fill(null).map(() => ({ band: i++, gain: levels[args[0]] }))
      });
      return message.channel.send(s(`Set the bassboost to **${args[0]}**\n*takes a few seconds to take affect*`));
    }

    case "pause": {
      const player = node.players.get(message.guild.id);
      if (!player) return message.channel.send(s(`Use \`!>play <song name or url>\` to start a queue`));

      if (player.paused) return message.channel.send(s("The player is already paused."));
      await player.pause();
      return message.channel.send(s(`Paused the player via request of **${message.author}**`));
    }

    case "resume": {
      const player = node.players.get(message.guild.id);
      if (!player) return message.channel.send(s(`Use \`!>play <song name or url>\` to start a queue`));

      if (!player.paused) return message.channel.send(s("The player isn't paused"));
      await player.resume();
      return message.channel.send(s(`Resumed the player via request of **${message.author}**`));
    }

    case "vol":
    case "volume": {
      const player = node.players.get(message.guild.id);
      if (!player) return message.channel.send(s(`Use \`!>play <song name or url>\` to start a queue`));

      await player.setVolume(parseInt(args[0]));
      return message.channel.send(s(`Set the players volume to \`${args[0]}\` via request of **${message.member}**`));
    }

    case "stop": {
      const player = node.players.get(message.guild.id);
      if (!player) return message.channel.send(s(`Use \`!>play <song name or url>\` to start a queue`));

      queues[message.guild.id] = [];
      await player.stop();
      return message.channel.send(s(`Stopped the player, use \`i>play <song name or url>\` to play a song`));
    }
  }
});
