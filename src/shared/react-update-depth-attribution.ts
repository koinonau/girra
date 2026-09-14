/**
 * react-dom 19.2.x NESTED_UPDATE_LIMIT. getRootForUpdatedFiber throws once the
 * root-global nested-update counter passes it. Every diagnostic that budgets
 * commits against React's bail must derive its threshold from this one number.
 */
export const REACT_NESTED_UPDATE_LIMIT = 50
