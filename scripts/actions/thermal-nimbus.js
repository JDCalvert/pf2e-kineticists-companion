import { Chat } from "../utils/chat.js";

const THERMAL_NIMBUS_FEAT_ID = "Compendium.pf2e.feats-srd.Item.XJCsa3UbQtsKcqve";
const THERMAL_NIMBUS_STANCE_ID = "Compendium.pf2e.feat-effects.Item.2EMak2C8x6pFwoUi";
const THERMAL_NIMBUS_DAMAGE_EFFECT_ID = "Compendium.pf2e-kineticists-companion.items.Item.TQCve77Ryu4b764B";

const DamageRoll = CONFIG.Dice.rolls.find((r) => r.name === "DamageRoll");

export class ThermalNimbus {
    static localize(key, data) {
        return game.i18n.format("pf2e-kineticists-companion.thermal-nimbus." + key, data);
    }

    static initialise() {
        if (!DamageRoll) {
            ui.notifications.error(this.localize("damage-roll-not-found"));
        }

        // Update the Thermal Nimbus stance to add the new damage effect
        Hooks.on(
            "preCreateItem",
            item => {
                if (item.sourceId == THERMAL_NIMBUS_STANCE_ID) {
                    const auraRule = item._source.system.rules.find(rule => rule.key === "Aura");
                    auraRule.effects.push(
                        {
                            "affects": "enemies",
                            "events": ["enter"],
                            "uuid": THERMAL_NIMBUS_DAMAGE_EFFECT_ID
                        }
                    );
                }
            }
        );

        // When a new turn begins, check if the combatant whose turn has just started is affected by Thermal Nimbus, and roll damage
        Hooks.on(
            "combatTurnChange",
            (encounter, previousState, currentState) => {
                // If we've gone back a turn, skip processing
                if (currentState.round < previousState.round || (currentState.round == previousState.round && currentState.turn < previousState.turn)) {
                    return;
                }

                const token = encounter.combatant?.token;
                if (!token) {
                    return;
                }

                const thermalNimbusDamageEffect = token.actor.itemTypes.effect.find(effect => effect.sourceId === THERMAL_NIMBUS_DAMAGE_EFFECT_ID);
                if (!thermalNimbusDamageEffect) {
                    return;
                }

                this.#rollThermalNimbusDamage(thermalNimbusDamageEffect, token);
            }
        );

        // If a token receives the Thermal Nimbus Damage effect on its turn, it must have moved into the aura, so roll damage
        Hooks.on(
            "createItem",
            item => {
                if (item.sourceId != THERMAL_NIMBUS_DAMAGE_EFFECT_ID) {
                    return;
                }

                const actor = item.actor;
                if (!actor) {
                    return;
                }

                const token = actor.getActiveTokens()[0];
                if (!token) {
                    return;
                }

                if (game.combat?.current?.tokenId === token.id) {
                    this.#rollThermalNimbusDamage(item, token.document);
                }
            }
        );
    }

    static async #rollThermalNimbusDamage(thermalNimbusDamageEffect, token) {
        const originActor = thermalNimbusDamageEffect.origin;
        if (!originActor) {
            return;
        }

        // The origin actor's primary updater should be posting the damage.
        if (originActor.primaryUpdater != game.user) {
            return;
        }

        const thermalNimbusFeat = originActor.itemTypes.feat.find(feat => feat.sourceId === THERMAL_NIMBUS_FEAT_ID);
        if (!thermalNimbusFeat) {
            return;
        }

        Chat.rollInlineDamage(
            thermalNimbusFeat,
            "(floor(@actor.level/2))[@actor.flags.system.kineticist.thermalNimbus]",
            {
                "pf2e-kineticists-companion": {
                    "applyDamage": {
                        "tokenId": token.uuid
                    }
                }
            }
        );
    }
}
