const { Plugin } = require("powercord/entities");
const { getModule, React } = require("powercord/webpack");

const { join } = require("path");
const { existsSync } = require("fs");
const { execSync } = require("child_process");
const nodeModulesPath = join(__dirname, "node_modules");

function installDeps() {
  console.log("Installing dependencies, please wait...");
  execSync("npm install --only=prod", {
    cwd: __dirname,
    stdio: [null, null, null],
  });
  console.log("Dependencies successfully installed!");
  powercord.pluginManager.remount(__dirname);
}

if (!existsSync(nodeModulesPath)) {
  installDeps();
  return;
}

const LastFMTyped = require("lastfm-typed").default;
const Settings = require("./Settings");

const { SET_ACTIVITY } = getModule(["SET_ACTIVITY"], false);
const clientID = "740140397162135563";
const lastFmKey = "52ffa34ebbd200da17da5a6c3aef1b2e";

module.exports = class customRPC extends Plugin {
  timerID;
  lastfm = new LastFMTyped(lastFmKey, {
    userAgent: "github.com/FayneAldan/lastfm-rp",
  });

  setActivity(activity) {
    SET_ACTIVITY.handler({
      isSocketConnected: () => true,
      socket: {
        id: 169,
        application: {
          id: clientID,
          name: this.settings.get("appName") || "Music",
        },
        transport: "ipc",
      },
      args: {
        pid: 10,
        activity: activity,
      },
    });
  }

  async activity() {
    if (!this.settings.get("enabled")) return undefined;

    const username = this.settings.get("username");
    if (!username) return undefined;

    const playing = await this.lastfm.helper.getNowPlaying(username);
    const track = playing.recent;
    if (!track.nowplaying) return undefined;

    const buttons = [];
    if (this.settings.get("shareName"))
      buttons.push({
        label: "Last.fm Profile",
        url: `https://www.last.fm/user/${username}`,
      });
    buttons.push({
      label: "View Song",
      url: track.url,
    });

    let small_text = "Scrobbling on last.fm";
    if (this.settings.get("shareName")) small_text += ` as ${username}`;

    return {
      details: track.track,
      state: `by ${track.artist}`,
      assets: {
        large_image: track.image[track.image.length - 1].url,
        small_image: "lastfm",
        large_text: track.album,
        small_text,
      },
      buttons,
    };
  }

  startPlugin() {
    // Setting Migration
    switch (this.settings.get("_version", 0)) {
      case 0:
        this.settings.set("enabled", false);
        this.settings.set("username", this.settings.get("username", ""));
      case 1:
        this.settings.set("shareName", true);
        this.settings.set("appName", "");
    }
    this.settings.set("_version", 2);

    powercord.api.settings.registerSettings(this.entityID, {
      category: this.entityID,
      label: "Last.fm Rich Presence",
      render: (props) => React.createElement(Settings, props),
    });

    this.timerID = setInterval(
      async () => this.setActivity(await this.activity()),
      5000
    );
  }

  pluginWillUnload() {
    this.setActivity(undefined);
    if (this.timerID) clearInterval(this.timerID);
    powercord.api.settings.unregisterSettings(this.entityID);
  }
};
