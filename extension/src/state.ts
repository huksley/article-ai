import logger from "./logger";
import { sendCall, sendMessage } from "./communication";

// DANGER! Changing this value will invalidate state for ALL extension users
export const LEGACY_STATE_KEY = "___valoisan_state";

export interface IState {
  token?: string;
  baseUrl?: string;
  paneVisible?: boolean;
  currentCampaignId?: string;
  contactFilter?: string;
  dialogShown?: boolean;
  onboarding?: number;
  userEmail?: string;
  disabled?: boolean;
  receiveAll?: boolean;
  save: () => void;
}

const saveState = function (state: IState) {
  const newState = {
    ...state,
  } as Record<string, unknown>;

  delete newState.save;
  logger.info("Saving state", newState);
  localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify(newState));
  sendMessage("setState", { state: newState });
};

export const createState = (): Promise<IState> => {
  return new Promise((resolve, reject) => {
    sendCall<{ state?: IState }>("getState")
      .then((response) => {
        logger.verbose("Response from getState", response);
        let state = response.state;

        const localState = localStorage.getItem(LEGACY_STATE_KEY);
        if ((!state || Object.entries(state).length === 0) && localState) {
          // Empty, try to restore from localStorage
          state = JSON.parse(localState);
        }

        if (!state || Object.entries(state).length === 0) {
          // Empty, try to init
          state = {} as IState;
        }

        state.receiveAll = state.receiveAll === undefined ? true : state.receiveAll;
        state.save = () => saveState(state as IState);
        resolve(state);
      })
      .catch((err) => {
        logger.warn("Failed to retrieve state from extension", err);
        reject(err);
      });
  });
};
