import logger from "./logger";
import { IState } from "./state";

export class UI {
  private state: IState;
  constructor(state: IState) {
    this.state = state;
  }

  start() {
    const button = document.querySelector('button[title="Yes, I’m happy"]') as HTMLButtonElement | undefined;
    if (button) {
      button.click();
    }
    logger.info("Starting on page", document);
  }
}
