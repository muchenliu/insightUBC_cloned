import {InsightError} from "./IInsightFacade";

/**
 * prefix of WHERE and OPTIONS clause
 *
 */
export default class PrefixHelper {
	// returns the first prefix it finds in options block
	public async options_prefix(curr_object: any, is_first_loop: boolean): Promise<string|null> {
		for (const i in curr_object) {
			if (!is_first_loop) {
				if (typeof curr_object[i] === "object") {
					// recursively calls function to find string
					return this.options_prefix(curr_object[i], false).then(function(str) {
						if (str !== null) {
							return str;
						}
					}).then(function(opt) {
						if (opt === undefined) {
							throw new InsightError();
						}
						return opt;
					});

				} else if (typeof curr_object[i] === "string") {
					let CURR_NAMES = null;

					// iterate through all possible columns to make sure they match
					for (const j in curr_object) {
						if (CURR_NAMES === null) {
							CURR_NAMES = curr_object[j].slice(0, curr_object[j].indexOf("_"));
						} else if (CURR_NAMES !== curr_object[j].slice(0, curr_object[j].indexOf("_"))) {
							console.log("AHHHHHH");
							return null;
						}
					}

					return CURR_NAMES;
					// return curr_object[i].slice(0, curr_object[i].indexOf("_"));
				}
			} else {
				is_first_loop = false;
			}
		}
		return null;
	}

	// returns the first prefix it finds in where block
	public async where_prefix(curr_object: any): Promise<string|null> {
		let IS_FIRST_LOOP = true;
		for (const i in curr_object) {
			if (IS_FIRST_LOOP) {
				if (typeof curr_object[i] === "object") {
					return this.where_prefix(curr_object[i]).then(function(str) {
						if (str !== null) {
							return str;
						}
					}).then(function(opt) {
						if (opt === undefined) {
							throw new InsightError();
						}
						return opt;
					});
				} else if (typeof curr_object[i] === "string" || typeof curr_object[i] === "number") {
					// console.log(curr_object);
					return i.slice(0, i.indexOf("_"));
				}
				IS_FIRST_LOOP = false;
			}
		}
		return null;
	}


}
