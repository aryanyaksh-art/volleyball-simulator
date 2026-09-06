import type { RuleSet } from '@/core/rules/ruleset';

/**
 * Encodes enough of the libero rules to be useful in a coaching tool, not
 * exhaustive. Back-row-only positioning falls out of the substitution logic
 * in systems.ts automatically (a libero only ever swaps into a back-row
 * slot), so it needs no special case here.
 */

export const canLiberoServe = (ruleSet: RuleSet): boolean => ruleSet.liberoCanServe;

export const canLiberoBlock = (): boolean => false;

/** A libero can't attack a ball whose contact point is entirely above the net's height. */
export const canLiberoAttack = (contactHeightM: number, netHeightM: number): boolean => contactHeightM <= netHeightM;

/**
 * A libero can't overhand-set from on/inside the attack line if that set
 * feeds an attack taken entirely above net height on the other side.
 */
export const canLiberoOverheadSetFromDepth = (
  depthFromNetM: number,
  attackLineM: number,
  nextContactIsAttackAboveNet: boolean,
): boolean => {
  const onOrInsideAttackLine = depthFromNetM <= attackLineM;
  return !(onOrInsideAttackLine && nextContactIsAttackAboveNet);
};
