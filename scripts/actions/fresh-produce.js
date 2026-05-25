import { Util } from "../utils/util.js";

const FRESH_PRODUCE_FEAT_ID = "Compendium.pf2e.feats-srd.Item.IcAEMf94XoTvtzAO";
const FRESH_PRODUCE_ITEM_ID = "Compendium.pf2e-kineticists-companion.items.Item.bkoprewUGSABeh1p";
const FRESH_PRODUCE_EFFECT_ID = "Compendium.pf2e.feat-effects.Item.2GWZgsvMJF9DN0DO";

const warn = (key, data) => ui.notifications.warn(game.i18n.format("pf2e-kineticists-companion.fresh-produce." + key, data));

export class FreshProduce {
    static initialise() {
        Hooks.on(
            "preCreateChatMessage",
            message => {
                const messageItem = message.item;
                if (!messageItem) {
                    return;
                }

                // Determine if the target is in our kinetic aura, and warn if not.
                if (messageItem.sourceId === FRESH_PRODUCE_FEAT_ID) {
                    const sourceActor = messageItem.actor;
                    if (!sourceActor) {
                        return;
                    }

                    const sourceToken = sourceActor.getActiveTokens()?.[0];
                    if (!sourceToken) {
                        return;
                    }

                    const targetToken = game.user.targets.first() ?? sourceToken;
                    if (!targetToken) {
                        return;
                    }

                    const aura = sourceToken.document.auras.get("kinetic-aura");
                    if (!aura) {
                        return;
                    }

                    if (!aura.containsToken(targetToken.document)) {
                        warn("target-outside-aura");
                        return false;
                    }

                    return;
                }

                // When we use the Fresh Produce item, apply the healing and effect
                if (messageItem.sourceId === FRESH_PRODUCE_ITEM_ID && message.isDamageRoll) {
                    const actor = messageItem.actor;
                    if (!actor) {
                        return;
                    }

                    // If we have the Fresh Produce effect already, we can't eat another fruit
                    if (actor.itemTypes.effect.find(effect => effect.sourceId === FRESH_PRODUCE_EFFECT_ID)) {
                        warn("already-eaten", { name: actor.name });
                        return false;
                    }

                    // Apply the healing
                    actor.applyDamage(
                        {
                            damage: -message.rolls[0].total,
                            token: actor.getActiveTokens()?.[0],
                            item: message.item,
                            rollOptions: new Set(actor.getRollOptions())
                        }
                    );

                    // Apply the effect
                    fromUuid(FRESH_PRODUCE_EFFECT_ID)
                        .then(
                            freshProduceEffect => {
                                const freshProduceEffectSource = freshProduceEffect.toObject();
                                freshProduceEffectSource.system.level.value = messageItem.level;
                                freshProduceEffectSource.system.rules
                                    .find(rule => rule.key === "Resistance")
                                    .value = "2 * ceil(@item.level / 2)";

                                actor.createEmbeddedDocuments("Item", [freshProduceEffectSource]);
                            }
                        );

                    return;
                }
            }
        );

        Hooks.on(
            "createChatMessage",
            async message => {
                // When the Fresh Produce feat is posted, create a Fresh Produce item in the target's inventory
                if (message.item?.sourceId === FRESH_PRODUCE_FEAT_ID) {
                    const sourceActor = message.item.actor;
                    if (!sourceActor) {
                        return;
                    }

                    const targetActor = message.author.targets.first()?.actor ?? sourceActor;
                    if (!targetActor) {
                        return;
                    }

                    // On the source actor, record the signature of the target actor, so we can remove any Fresh Produce that's left over at the start of
                    // our next turn.
                    if (sourceActor.primaryUpdater == game.user) {
                        const actorSignatures = sourceActor.flags["pf2e-kineticists-companion"]?.["fresh-produce"]?.["actor-signatures"] ?? [];
                        if (!actorSignatures.includes(targetActor.signature)) {
                            actorSignatures.push(targetActor.signature);
                            sourceActor.update({ "flags.pf2e-kineticists-companion.fresh-produce.actor-signatures": actorSignatures });
                        }
                    }

                    // On the target actor, create a Fresh Produce item
                    if (targetActor.primaryUpdater == game.user) {
                        const freshProduceSource = (await fromUuid(FRESH_PRODUCE_ITEM_ID)).toObject();
                        freshProduceSource.system.level.value = sourceActor.level;
                        freshProduceSource.system.damage.formula = `${Math.ceil(sourceActor.level / 2)}d4+${1 + Math.floor((sourceActor.level - 1) / 2) * 5}`;
                        freshProduceSource.flags["pf2e-kineticists-companion"] = {
                            "originSignature": sourceActor.signature
                        };

                        const [freshProduceItem] = await targetActor.createEmbeddedDocuments("Item", [freshProduceSource]);
                        if (!freshProduceItem) {
                            return;
                        }

                        freshProduceItem.update(
                            {
                                "system": {
                                    "equipped": {
                                        "carryType": targetActor.handsFree ? "held" : "dropped",
                                        "handsHeld": targetActor.handsFree ? 1 : 0
                                    }
                                }
                            }
                        );

                        // If we're out of combat, or we've created the item on our own turn, post the item so it's easy to consume.
                        if (!game.combat || targetActor === sourceActor) {
                            freshProduceItem.toMessage();
                        }
                    }
                }
            }
        );

        Hooks.on(
            "combatTurnChange",
            (encounter, previousState, currentState) => {
                // If we've gone back a turn, skip processing
                if (currentState.round < previousState.round || (currentState.round == previousState.round && currentState.turn < previousState.turn)) {
                    return;
                }

                const actor = encounter.combatant?.actor;
                if (!actor) {
                    return;
                }

                /** @type {string[]} */
                const actorSignatures = actor.flags["pf2e-kineticists-companion"]?.["fresh-produce"]?.["actor-signatures"] ?? [];

                // For any actors for whom we are the primary updater, delete any Fresh Produce, created by the combatant, in their inventory
                Array.from(game.combat.combatants)
                    .map(combatant => combatant.actor)
                    .filter(actor => actorSignatures.includes(actor.signature))
                    .filter(actor => actor.primaryUpdater === game.user)
                    .forEach(
                        combatantActor => {
                            const freshProduceIds = combatantActor.itemTypes.consumable
                                .filter(consumable => consumable.sourceId === FRESH_PRODUCE_ITEM_ID)
                                .filter(consumable => consumable.flags["pf2e-kineticists-companion"]?.originSignature === actor.signature)
                                .map(consumable => consumable.id);

                            if (freshProduceIds.length) {
                                combatantActor.deleteEmbeddedDocuments("Item", freshProduceIds);
                            }
                        }
                    );

                // Reset the combatant's signature list
                if (actor.primaryUpdater == game.user) {
                    if (Util.isUsingForcedDeletion()) {
                        actor.update(
                            {
                                "flags": {
                                    "pf2e-kineticists-companion": new foundry.data.operators.ForcedDeletion()
                                }
                            }
                        );
                    } else {
                        actor.update(
                            {
                                "flags": {
                                    "-=pf2e-kineticists-companion": null
                                }
                            }
                        );
                    }
                }
            }
        );
    }
}
