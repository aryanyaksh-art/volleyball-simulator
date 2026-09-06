/** Rules that vary by federation/level, kept separate from the fixed CourtSpec. */
export interface RuleSet {
  id: string;
  label: string;
  /** NCAA women's rules allow the libero to serve in one rotation; FIVB/most others don't. */
  liberoCanServe: boolean;
}

export const DEFAULT_RULESET: RuleSet = {
  id: 'fivb',
  label: 'FIVB / standard',
  liberoCanServe: false,
};

export const NCAA_RULESET: RuleSet = {
  id: 'ncaa',
  label: 'NCAA women’s',
  liberoCanServe: true,
};
