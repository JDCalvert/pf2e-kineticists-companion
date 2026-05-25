# FVTT PF2e Kineticist's Companion
A module for the Foundry VTT Pathfinder 2e system that provides improved automation for the Kineticist class.

![Github All Releases](https://img.shields.io/github/downloads/JDCalvert/pf2e-kineticists-companion/total.svg)
![Github Latest Release](https://img.shields.io/github/downloads/JDCalvert/pf2e-kineticists-companion/2.1.3/total)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jdcalvert)

## Issues and System Compatibility
This module is built for the Pathfinder 2e system, which receives regular updates, and some of those updates may occassionally break the functionality of this module. I will do my best to fix issues caused by updates, but this may require losing support for earlier versions of the system. Also, some parts of this module may require features/functions from the latest release of the Pathfinder 2e system.

In summary, each release of this module only officially supports the latest release of the Pathfinder 2e system at the time of release, which will be listed in the [Changelog](/CHANGELOG.md). If you encounter an issue, please make sure you're using the latest system version. If the issue persists on the most recent version, please [report it](https://github.com/JDCalvert/pf2e-kineticists-companion/issues/new)!

## Features

### :earth_americas::earth_asia::earth_africa:
### Armor in Earth
When you use the Armor in Earth impulse, your armor (if any) is replaced with **Armor in Earth** armor. The armor contains duplicates of any runes on your armor.

When the impulse ends, the Armor in Earth armor is removed and your original armor (if any) is re-equipped.

<small>
    <b>Configuration</b>
    <ul>
        <li>The impulse can be configured to have an unlimited duration to handwave re-using the impulse during exploration mode.</li>
    </ul>
</small>

### :fire::fire::fire:

### Ignite the Sun
When you use the Ignite the Sun impulse, you are prompted to choose a space to spawn your miniature sun. The sun is then created as an actor, a template (showing where the sun's damage applies), light source. The actor's aura provides allies with the 1d6 fire damage bonus.

When you use the Sustain action, you are prompted to Sustain the feat's effects, if you have not already done so this turn. When you do, you are asked if you wish to increase the sun's size (answering no will still sustain the effect). If you do not Sustain the effect, the feat will end at the end of your turn.

When you create or sustain the sun, and there are tokens inside its template (with its increased size, if you chose to do so) that have not been damaged by the sun this round, the feat's damage automatically rolls. If you have PF2e Toolbelt with Target Helper enabled, the damage is targetted correctly.

<small>
    <b>Notes</b>
    <ul>
        <li>A gamemaster must be present for all parts of this automation to function.</li>
        <li>Saving throws and damage application are not automated.</li>
    </ul>
    <b>Required Modules</b>
    <ul>
        <li><a href="https://foundryvtt.com/packages/portal-lib">Portal</a></li>
        <li><a href="https://foundryvtt.com/packages/socketlib">socketlib</a></li>
        <li><a href="https://foundryvtt.com/packages/lib-wrapper">libWrapper</a></li>
    </ul>
    <b>Recommended Modules</b>
    <ul>
        <li><a href="https://github.com/reonZ/pf2e-toolbelt">PF2e Toolbelt</a> with Target Helper enabled.</li>
    </ul>
</small>

### Kindle Inner Flames
When affected by Kindle Inner Flames, the effect will add a toggleable roll option to enable the additional fire damage (or flaming rune effect). If the Kineticist has the Fire Aura Junction, and the target of the Strike is within in the Kineticist's aura, the target will be weak to the fire damage dealt by the Kineticist's allies' Strikes.

### Thermal Nimbus
When you use the Thermal Nimbus stance, enemies inside the aura receive the **Effect: Thermal Nimbus Damage** effect. If an enemy is inside the aura at the start of its turn, or they move into the aura during their turn, the Thermal Nimbus damage is automatically rolled and applied to that enemy.

<small>
    <b>Notes</b>
    <ul>
        <li>A gamemaster must be present for this damage to be applied automatically.</li>
    </ul>
    <b>Configuration</b>
    <ul>
        <li>The automatic application of damage can be disabled.</li>
    </ul>
</small>

### :deciduous_tree::deciduous_tree::deciduous_tree:

### Dash of Herbs
When you apply healing from the Dash of Herbs impulse, the **Effect: Dash of Herbs Immunity** effect is automatically applied. You cannot apply healing from Dash of Herbs again while you have this effect.

<small>
    <b>Required Modules</b>
    <ul>
        <li><a href="https://foundryvtt.com/packages/lib-wrapper">libWrapper</a></li>
    </ul>
</small>

### Fresh Produce
When you use the Fresh Produce impulse, a **Fresh Produce** item is created in your target's inventory (or your inventory, if you have no target). If you use Fresh Produce on yourself in combat, or on anyone outside of combat, the item is posted to chat with a "use" button for easy immediate use. Using this item automatically applies the healing and the void resistance effect.

Any unused Fresh Produce items are removed at the start of your next turn.

<small>
    <b>Notes</b>
    <ul>
        <li>A gamemaster or owner must be present for manipulation of another actor's inventory</li>
    </ul>
</small>

### Hardwood Armor
When you use the Hardwood Armor impulse, your armor (if any) is replaced with Hardwood Armor and, if you have a free hand, you are prompted to create a wooden shield.

When the impulse ends, the Hardwood Armor and shield are removed and your original armor (if any) is re-equipped. If the shield takes enough damage to become broken, it is automatically removed.

<small>
    <b>Configuration</b>
    <ul>
        <li>The impulse can be configured to have an unlimited duration to handwave re-using the impulse during exploration mode.</li>
        <li>The shield prompt can be configured to always ask, always create, or never create, the shield.</li>
    </ul>
</small>

### Timber Sentinel
When you use the Timber Sentinel impulse, you are prompted to select a space to spawn the protector tree. Any allies that take damage from Strikes automatically have the damage reduced by the tree.

<small>
    <b>Notes</b>
    <ul>
        <li>A gamemaster must be present for all parts of this automation to function.</li>
        <li>Damage with multiple instances is reduced in the order that it appears in the data. Any instance that is reduced to 0 will not process at all for the target, and so will not trigger resistances and weaknesses.</li>
    </ul>
    <b>Required Modules</b>
    <ul>
        <li><a href="https://foundryvtt.com/packages/portal-lib">Portal</a></li>
        <li><a href="https://foundryvtt.com/packages/socketlib">socketlib</a></li>
        <li><a href="https://foundryvtt.com/packages/lib-wrapper">libWrapper</a></li>
    </ul>
</small>

### :dagger::shield::hammer_and_wrench:

### Metal Carapace
When you use the Metal Carapace impulse, your armor (if any) is replaced with **Metal Carapace Armor** and, if you have a free hand, you are prompted to create a wooden shield.

When the impulse ends, the Metal Carapace Armor and shield are removed and your original armor (if any) is re-equipped.

If the shield takes enough damage to become broken, it is automatically removed. If you take damage from a critical hit, the impulse ends.

<small>
    <b>Configuration</b>
    <ul>
        <li>The impulse can be configured to have an unlimited duration to handwave re-using the impulse during exploration mode.</li>
        <li>The shield prompt can be configured to always ask, always create, or never create, the shield.</li>
    </ul>
</small>

### :droplet::ocean::droplet:

### Ocean's Balm
When you apply the healing from Ocean's Balm impulse, the **Effect: Ocean's Balm** and **Effect: Ocean's Balm Immunity** effects are automatically applied. If you attempt to apply healing from Ocean's Balm again while you have the immunity effect, the healing will not apply (but the fire resistance effect will re-apply).

<small>
    <b>Required Modules</b>
    <ul>
        <li><a href="https://foundryvtt.com/packages/lib-wrapper">libWrapper</a></li>
    </ul>
</small>

### Torrent in the Blood
When you apply healing from the Torrent in the Blood impulse, the **Effect: Torrent in the Blood Immunity** effect is automatically applied. You cannot apply healing from Torrent in the Blood again while you have this effect.

<small>
    <b>Required Modules</b>
    <ul>
        <li><a href="https://foundryvtt.com/packages/lib-wrapper">libWrapper</a></li>
    </ul>
</small>
