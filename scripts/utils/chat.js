import { Util } from "./util.js";

const DamageRoll = CONFIG.Dice.rolls.find((r) => r.name === "DamageRoll");

const actionGlyphMap = {
    0: "F",
    free: "F",
    1: "1",
    2: "2",
    3: "3",
    "1 or 2": "1/2",
    "1 to 3": "1 - 3",
    "2 or 3": "2/3",
    "2 rounds": "3,3",
    reaction: "R",
};

export class Chat {
    static async postToChat(actor, message, imgPath) {
        ChatMessage.create(
            {
                type: CONST.CHAT_MESSAGE_STYLES.EMOTE,
                speaker: ChatMessage.getSpeaker({ actor }),
                content: await Util.render(
                    "./systems/pf2e/templates/chat/action/content.hbs",
                    {
                        imgPath,
                        message
                    }
                )
            }
        );
    }

    static async rollInlineDamage(item, baseFormula, additionalFlags = {}, additionalText = "", additionalRollOptions = []) {
        const html = (await item.getChatData()).description.value;
        const results = $($.parseHTML(html)).find(".inline-roll");
        const damageElement = Array.from(results).find(result => result.dataset.baseFormula === baseFormula);
        if (!damageElement) {
            console.warn("pf2e-kineticists-companion | Could not find inline damage roll matching formula:", baseFormula);
            return;
        }
        const damageDataSet = damageElement.dataset;

        const slug = item.slug;
        const traits = item.system.traits.value;
        const actionCost = item.actionCost.value;

        const damageRoll = new DamageRoll(
            damageDataSet.formula,
            {
                actor: item.actor,
                item: item
            }
        );

        damageRoll.toMessage(
            {
                speaker: ChatMessage.getSpeaker({ actor: item.actor }),
                flavor: await this.#buildDamageMessageFlavour(item, additionalText),
                flags: {
                    ...additionalFlags,
                    "pf2e": {
                        context: {
                            type: "damage-roll",
                            actor: item.actor.id,
                            domains: Array.from(damageRoll.kinds)
                                .flatMap(
                                    kind => [
                                        kind,
                                        `inline-${kind}`,
                                        `${item.id}-inline-${kind}`,
                                        `${item.slug}-inline-${kind}`
                                    ]
                                ),
                            traits: item.system.traits.value,
                            options: [
                                ...item.system.traits.value,
                                ...item.actor.getRollOptions(),
                                ...item.getRollOptions("item"),
                                `action:${slug}`,
                                `action:cost:${actionCost}`,
                                `self:action:slug:${slug}`,
                                `self:action:cost:${actionCost}`,
                                ...traits.map(trait => `self:action:trait:${trait}`),
                                ...damageDataSet.rollOptions?.split(",") ?? [],
                                ...additionalRollOptions
                            ]
                        },
                        origin: item.getOriginData()
                    },
                }
            }
        );
    }

    static async #buildDamageMessageFlavour(item, additionalText) {
        let flavor = await Util.render(
            "systems/pf2e/templates/chat/action/header.hbs",
            {
                title: item.name,
                subtitle: game.i18n.localize(`PF2E.Damage.Kind.Damage.Roll.Noun`),
                glyph: this.#getActionGlyph(item.actionCost),
            }
        );

        const traits = item.system.traits.value
            .map(
                trait => (
                    {
                        value: trait,
                        label: game.i18n.localize(CONFIG.PF2E.actionTraits[trait] ?? "")
                    }
                )
            )
            .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
            .map(
                tag => {
                    const description = CONFIG.PF2E.traitsDescriptions[tag.value] ?? "";

                    const span = document.createElement("span");
                    span.className = "tag";
                    span.dataset["trait"] = tag.value;
                    if (description) {
                        span.dataset.tooltip = description;
                    }
                    span.innerText = tag.label;

                    return span.outerHTML;
                }
            )
            .join("");

        const div = document.createElement("div");
        div.classList.add("tags");
        div.dataset["tooltipClass"] = "pf2e";

        div.innerHTML = traits;
        div.innerHTML += additionalText;

        flavor += div.outerHTML;
        flavor += "\n<hr />";

        return flavor;
    }

    /**
     * Returns a character that can be used with the Pathfinder action font
     * to display an icon. If null it returns empty string.
     */
    static #getActionGlyph(action) {
        if (!action && action !== 0) return "";

        const value = typeof action !== "object" ? action : action.type === "action" ? action.value : action.type;
        const sanitized = String(value ?? "")
            .toLowerCase()
            .trim();

        return actionGlyphMap[sanitized]?.replace("-", "–") ?? "";
    }
}
