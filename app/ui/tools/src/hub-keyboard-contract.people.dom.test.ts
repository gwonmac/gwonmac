/** The keyboard contract's DOM cells for these views (hub-keyboard-contract.ts); one file per group so they run in parallel. */
import { keyboardContract } from './hub-keyboard-contract';

keyboardContract(['person', 'accounts', 'calculator', 'review-details']);
