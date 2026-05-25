import { Settings } from "../config/settings.js";
import { Chat } from "../utils/chat.js";
import { Document } from "../utils/document.js";
import { DialogPrompt } from "../utils/prompt-dialog.js";
import { Socket } from "../utils/socket.js";
import { Template } from "../utils/template.js";
import { User } from "../utils/user.js";
import { Util } from "../utils/util.js";
import { Sustain } from "./sustain.js";

const IGNITE_THE_SUN_FEAT_ID = "Compendium.pf2e.feats-srd.Item.uKeUPPqV1cNnIy0h";
const IGNITE_THE_SUN_EFFECT_ID = "Compendium.pf2e-kineticists-companion.items.Item.G3tO0dV1mSZ2NWCN";
const IGNITED_SUN_AURA_ID = "Compendium.pf2e-kineticists-companion.items.Item.lWxumqQjCTQQm4Ty";
const SUN_ACTOR_ID = "Compendium.pf2e-kineticists-companion.actors.Actor.kCPpSGvH0yTZ58KN";

export class IgniteTheSun {
    static localize(key, data) {
        return game.i18n.format("pf2e-kineticists-companion.ignite-the-sun." + key, data);
    }

    static initialise() {
        // We need these modules for this functionality to work
        if (!(
            game.modules.get("portal-lib").active &&
            game.modules.get("socketlib").active &&
            game.modules.get("lib-wrapper").active
        )) {
            return;
        }

        if (!Settings.get("ignite-the-sun-enable")) {
            return;
        }

        Hooks.on(
            "ready",
            () => {
                Socket.register("igniteTheSun.create", async data => IgniteTheSun.#createSun(data));
                Socket.register("igniteTheSun.sustain", async data => await IgniteTheSun.#sustainSun(data));
            }
        );

        Hooks.on(
            "preCreateChatMessage",
            message => {
                if (message.item?.sourceId !== IGNITE_THE_SUN_FEAT_ID) {
                    return;
                }

                // If the message isn't a roll or damage taken, then it must be the feat itself being posted
                if (!message.isRoll && message.flags.pf2e?.context?.type !== "damage-taken") {
                    const scene = canvas.scene;
                    if (!scene) {
                        return;
                    }

                    const actor = message.item.actor;
                    if (!actor) {
                        return;
                    }

                    const token = actor.getActiveTokens()[0];
                    if (!token) {
                        return;
                    }

                    // We need a gamemaster present to do this
                    if (!User.isGMConnected) {
                        ui.notifications.error(this.localize("no-gamemaster.create"));
                        return;
                    }

                    (async () => {
                        const location = await new Portal()
                            .origin(token)
                            .range(500)
                            .size(10)
                            .pick();

                        if (!location) {
                            return;
                        }

                        const fireImpulseJunction = actor.getRollOptions().find(option => option == "junction:fire:impulse");

                        // Create the sun, template, and light
                        const sunData = await Socket.call(
                            "igniteTheSun.create",
                            {
                                alliance: actor.alliance,
                                sceneId: scene.uuid,
                                location,
                                origin: {
                                    actor: actor.uuid,
                                    rollOptions: [
                                        ...actor.getSelfRollOptions("origin"),
                                        ...message.item.getRollOptions("origin:item"),
                                        ...(fireImpulseJunction ? [fireImpulseJunction] : [])
                                    ],
                                    type: message.item.type,
                                    uuid: message.item.uuid
                                }
                            }
                        );

                        // Add the Ignite the Sun effect to the actor
                        const igniteTheSunEffectSource = await Document.getSource(IGNITE_THE_SUN_EFFECT_ID);
                        igniteTheSunEffectSource.flags["pf2e-kineticists-companion"] = {
                            sustain: {
                                canSustainMoreThanOnce: false,
                                sustained: true
                            },
                            sunTokenId: sunData.sunTokenId,
                            templateId: sunData.templateId
                        };

                        await actor.createEmbeddedDocuments("Item", [igniteTheSunEffectSource]);

                        // If there are are any tokens inside the sun as we spawned it, roll damage
                        this.#checkAndRollDamage(
                            {
                                scene: scene,
                                template: Document.get(sunData.templateId),
                                overrideUserCheck: true
                            }
                        );
                    })();
                }
            }
        );

        // If the Ignite the Sun effect is deleted, also delete the linked sun
        Hooks.on(
            "deleteItem",
            item => {
                if (item.sourceId === IGNITE_THE_SUN_EFFECT_ID) {
                    const flags = Util.getFlags(item);
                    if (!flags) {
                        return;
                    }

                    if (User.isActiveGM) {
                        Document.get(flags.sunTokenId)?.delete();
                    } else if (User.isPrimaryUpdater(item.actor) && !User.isGMConnected) {
                        ui.notifications.error(this.localize("no-gamemaster.delete"));
                    }
                }
            }
        );

        // While we're deleting the sun, delete the linked template and light, and the origin actor's Ignite the Sun effect
        Hooks.on(
            "preDeleteToken",
            token => {
                const actor = token.actor;
                if (!actor) {
                    return;
                }

                const ignitedSunAura = actor.itemTypes.effect.find(effect => effect.sourceId === IGNITED_SUN_AURA_ID);
                if (ignitedSunAura) {
                    const flags = Util.getFlags(ignitedSunAura);
                    if (!flags) {
                        return;
                    }

                    const actor = Document.get(flags.originActorId);
                    if (actor) {
                        actor.itemTypes.effect
                            .filter(effect => effect.sourceId === IGNITE_THE_SUN_EFFECT_ID)
                            .find(effect => Util.getFlags(effect)?.sunTokenId === token.uuid)
                            ?.delete();
                    }
                    Document.get(flags.templateId)?.delete();
                    Document.get(flags.lightId)?.delete();
                }
            }
        );

        // Stop the sun being able to provide flanking
        libWrapper.register(
            "pf2e-kineticists-companion",
            "CONFIG.PF2E.Actor.documentClasses.npc.prototype.canAct",
            function (canAct) {
                if (this.sourceId === SUN_ACTOR_ID) {
                    return false;
                }

                return canAct();
            }
        );

        // Handle sustaining the impulse
        Sustain.registerSustainableEffect(
            IGNITE_THE_SUN_EFFECT_ID,
            async igniteTheSunEffect => {
                const flags = Util.getFlags(igniteTheSunEffect);
                if (!flags) {
                    return;
                }

                // Ask if we should increase the radius and move it
                const response = await DialogPrompt.prompt(this.localize("sustain-prompt.title"), this.localize("sustain-prompt.content"), false);
                if (response.answer) {
                    if (User.isGMConnected) {
                        await Socket.call(
                            "igniteTheSun.sustain",
                            {
                                sunTokenId: flags.sunTokenId,
                                templateId: flags.templateId,
                                expand: true
                            }
                        );
                    } else {
                        ui.notifications.error(this.localize("no-gamemaster.sustain"));
                    }
                }

                const template = Document.get(flags.templateId);
                if (!template) {
                    return;
                }

                this.#checkAndRollDamage(
                    {
                        scene: template.parent,
                        template,
                        overrideUserCheck: true
                    }
                );
            }
        );

        // Damage a token at the start of its turn
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

                const scene = token.scene;
                this.#checkAndRollDamage({ scene, token });
            }
        );

        Hooks.on(
            "createChatMessage",
            message => {
                const context = message.flags.pf2e?.context;
                if (game.combat && context?.type === "damage-taken" && message.token) {
                    const sunTokenId = context.options.find(option => option.startsWith("sunTokenId:"))?.replace("sunTokenId:", "");
                    if (!sunTokenId) {
                        return;
                    }

                    const sunToken = Document.get(sunTokenId);
                    if (!sunToken) {
                        return;
                    }

                    if (!User.isPrimaryUpdater(sunToken.actor)) {
                        return;
                    }

                    const sunAura = Util.findItem(sunToken.actor, "effect", IGNITED_SUN_AURA_ID);
                    if (!sunAura) {
                        return;
                    }

                    // Update the sun's aura to track that we damaged this token on this round
                    const flags = Util.getFlags(sunAura) ?? {};
                    flags["damage-round"] ??= {};
                    flags["damage-round"][message.token.id] = game.combat.round;

                    sunAura.update({ "flags.pf2e-kineticists-companion": flags });
                }
            }
        );
    }

    /**
     * @param {{
     *  alliance: string
     *  sceneId: string,
     *  location: {
     *      x: number,
     *      y: number
     *  },
     *  origin: {
     *      actor: string,
     *      rollOptions: string[],
     *      type: string,
     *      uuid: string
     *  }
     * }} data
     * 
     * @returns {{
     *  sunTokenId: string
     *  templateId: string
     * }}
     */
    static async #createSun(data) {
        const scene = Document.get(data.sceneId);
        if (!scene) {
            return;
        }

        console.log(data);

        // Find either an actor in the world, or create one
        let sunActor = game.actors.find(actor => actor.sourceId === SUN_ACTOR_ID);
        if (!sunActor) {
            const sunActorSource = await Document.getSource(SUN_ACTOR_ID);
            sunActor = await Actor.implementation.create(sunActorSource);
        }

        const sunTokenSource = await sunActor.getTokenDocument();
        sunTokenSource.updateSource(
            {
                x: data.location.x - (sunTokenSource.width / 2) * scene.grid.size,
                y: data.location.y - (sunTokenSource.width / 2) * scene.grid.size
            }
        );

        const [sunToken] = await scene.createEmbeddedDocuments("Token", [sunTokenSource]);
        if (!sunToken) {
            return;
        }

        if (sunToken.actor.alliance !== data.alliance) {
            sunToken.actor.update({ "system.details.alliance": data.alliance });
        }

        // Create the template representing the sun's area
        const [sunTemplate] = await scene.createEmbeddedDocuments(
            "MeasuredTemplate",
            [
                {
                    x: data.location.x,
                    y: data.location.y,
                    distance: 5,
                    fillColor: "#ff8000",
                    t: "circle",
                    flags: {
                        "pf2e": {
                            "areaShape": "burst",
                            "origin": data.origin,
                        },
                        "pf2e-kineticists-companion": {
                            "ignite-the-sun": {
                                "originActorId": data.origin.actor,
                                "sunTokenId": sunToken.uuid
                            }
                        }
                    }
                }
            ]
        );

        // Create the light for the sun's light effect
        const [sunLight] = await scene.createEmbeddedDocuments(
            "AmbientLight",
            [
                {
                    config: {
                        bright: 500,
                        dim: 1000,
                    },
                    x: data.location.x,
                    y: data.location.y
                }
            ]
        );

        const ignitedSunAuraSource = await Document.getSource(IGNITED_SUN_AURA_ID);
        ignitedSunAuraSource.flags["pf2e-kineticists-companion"] = {
            templateId: sunTemplate.uuid,
            lightId: sunLight.uuid,
            originActorId: data.origin.actor
        };

        const fireImpulseJunction = data.origin.rollOptions.find(option => option === "junction:fire:impulse");
        if (fireImpulseJunction) {
            ignitedSunAuraSource.system.rules.push(
                {
                    "key": "RollOption",
                    "option": `self:${fireImpulseJunction}`
                }
            );
        }

        await sunToken.actor.createEmbeddedDocuments("Item", [ignitedSunAuraSource]);

        return {
            sunTokenId: sunToken.uuid,
            templateId: sunTemplate.uuid,
            lightId: sunLight.uuid
        };
    }

    /**
     * @param {{
     *  sunTokenId: string,
     *  templateId: string,
     *  expand: boolean
     * }} data the details of how to sustain the sun
     */
    static async #sustainSun(data) {
        if (data.expand) {
            // Increase the size of the template
            const template = Document.get(data.templateId);
            if (template) {
                await template.update({ distance: template.distance + 5 });
            }

            // Increase the size of the sun
            const sunToken = Document.get(data.sunTokenId);
            if (sunToken) {
                const scene = sunToken.parent;
                const gridSize = scene.grid.size;

                await sunToken.update(
                    {
                        width: sunToken.width + 2,
                        height: sunToken.height + 2,
                        x: sunToken.x - gridSize,
                        y: sunToken.y - gridSize
                    }
                );
            }
        }
    }

    /**
     * @param {{
     *  scene: any,
     *  template: any?,
     *  token: any?
     * }} data 
     */
    static #checkAndRollDamage(data) {
        let templates;
        let tokens;

        if (data.token) {
            tokens = [data.token];
        } else {
            if (game.combat?.scene === data.scene) {
                tokens = game.combat.combatants.map(combatant => combatant.token);
            } else {
                tokens = Array.from(data.scene.tokens);
            }
        }

        if (data.template) {
            templates = [data.template];
        } else {
            templates = data.scene.templates.filter(this.#isActiveSunTemplate);
        }

        templates.forEach(
            template => {
                const templateFlags = Util.getFlags(template)["ignite-the-sun"];

                const sunToken = Document.get(templateFlags.sunTokenId);
                const sunAura = Util.findItem(sunToken.actor, "effect", IGNITED_SUN_AURA_ID);
                const sunAuraFlags = Util.getFlags(sunAura);

                const tokensForTemplate = tokens.filter(
                    token => {
                        if (game.combat?.scene === data.scene && game.combat.round <= sunAuraFlags?.["damage-round"]?.[token.id]) {
                            return false;
                        }

                        return Template.containsToken(token, template);
                    }
                );

                if (!tokensForTemplate.length) {
                    return;
                }

                const originActor = Document.get(templateFlags.originActorId);

                // Check that someone is able to roll damage, and warn if not
                const updater = User.getPreferredUpdater(originActor);
                if (!data.overrideUserCheck && !updater) {
                    ui.notifications.warn(this.localize("no-user.roll-damage"));
                    return;
                }

                // If we are the preferred updater for the origin actor, roll the damage
                if (data.overrideUserCheck || updater === game.user) {
                    const igniteTheSunFeat = originActor.itemTypes.feat.find(feat => feat.sourceId === IGNITE_THE_SUN_FEAT_ID);
                    if (!igniteTheSunFeat) {
                        return;
                    }

                    let additionalText = "";
                    const additionalFlags = {
                        "pf2e-kineticists-companion": {
                            "ignite-the-sun": {
                                "sunTokenId": Util.getFlags(template)["ignite-the-sun"].sunTokenId
                            }
                        },
                    };

                    if (game.modules.get("pf2e-toolbelt")?.active && game.settings.get("pf2e-toolbelt", "targetHelper.enabled")) {
                        additionalFlags["pf2e-toolbelt"] = {
                            targetHelper: {
                                save: {
                                    author: originActor.uuid,
                                    basic: true,
                                    dc: originActor.classDCs.kineticist.dc.value,
                                    statistic: "reflex"
                                },
                                targets: tokensForTemplate.map(token => token.uuid)
                            }
                        };
                    } else {
                        additionalText = "<p>@Check[reflex|against:kineticist|basic|options:area-effect]</p>";
                    }

                    Chat.rollInlineDamage(
                        igniteTheSunFeat,
                        "7d6[fire]",
                        additionalFlags,
                        additionalText,
                        [`sunTokenId:${templateFlags.sunTokenId}`]
                    );
                }
            }
        );
    }

    static #isActiveSunTemplate(template) {
        const templateFlags = Util.getFlags(template)?.["ignite-the-sun"];
        if (!templateFlags) {
            return false;
        }

        const sunToken = Document.get(templateFlags.sunTokenId);
        if (!sunToken) {
            return false;
        }

        const sunAura = Util.findItem(sunToken.actor, "effect", IGNITED_SUN_AURA_ID);
        if (!sunAura) {
            return false;
        }

        const sunAuraFlags = Util.getFlags(sunAura);
        if (!sunAuraFlags) {
            return false;
        }

        // Make sure that the sun is sustained - otherwise we may take damage just as it's about to disappear
        const originActor = Document.get(sunAuraFlags.originActorId);
        if (!originActor) {
            return;
        }

        const igniteTheSunEffectIsSustained = originActor.itemTypes.effect.some(
            effect => {
                if (effect.sourceId !== IGNITE_THE_SUN_EFFECT_ID) {
                    return false;
                }

                const effectFlags = Util.getFlags(effect);

                return effectFlags?.tunTokenId === templateFlags.sunTokenId
                    && effectFlags?.sustain?.sustained;
            }
        );
        if (!igniteTheSunEffectIsSustained) {
            return false;
        }

        return true;
    }
}
