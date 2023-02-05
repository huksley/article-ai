// PRAGMA: keep-js, standalone
"use strict";

import logger from "./logger";
import { createState } from "./state";
import { UI } from "./UI";

logger.info("Loading extension, mode", process.env.NODE_ENV, "release", process.env.GIT_TAGS);

createState().then((state) => new UI(state).start());
