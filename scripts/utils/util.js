export class Util {
    static localize(key, params) {
        return game.i18n.format(`pf2e-kineticists-companion.util.${key}`, params);
    }

    static getFlags(object) {
        return object?.flags?.["pf2e-kineticists-companion"];
    }

    static findItem(actor, type, sourceId) {
        return actor.itemTypes[type].find(item => item.sourceId === sourceId);
    }

    static isUsingApplicationV2() {
        return foundry.utils.isNewerVersion(game.version, "13");
    }

    static isUsingForcedDeletion() {
        return foundry.utils.isNewerVersion(game.version, "14");
    }

    static async render(path, data) {
        if (this.isUsingApplicationV2()) {
            return foundry.applications.handlebars.renderTemplate(path, data);
        } else {
            return renderTemplate(path, data);
        }
    }
}
