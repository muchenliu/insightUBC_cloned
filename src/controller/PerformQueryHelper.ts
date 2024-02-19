import Section from "./Section";
import {InsightError,
	InsightResult,
	ResultTooLargeError} from "./IInsightFacade";


/**
 * PerformQuery helper functions class
 *
 */
export default class PerformQueryHelper {
	private readonly dir: string;

	constructor(directory: string) {
		this.dir = directory;
	}

	// helper function to handle WHERE clause
	public handleWhere(query: any, file: string, negate: boolean): Section[] {
		let mathComps: string[] = ["LT", "GT", "EQ"];
		let dir = this.dir;
		let queryHandler: PerformQueryHelper = new PerformQueryHelper(dir);
		if ("AND" in query && !negate) {
			// get the filter list inside AND clause
			// forEach filter, call handleWhere
			// return a duplication of all filter
			return queryHandler.handleAnd(query.AND, file, false);
		} else if ("AND" in query && negate) {
			return queryHandler.handleOr(query.AND, file, true);
		} else if ("OR" in query && !negate) {
			// get the filter list inside OR clause
			// forEach filter, call handleWhere
			// return a summation of all filter
			return queryHandler.handleOr(query.OR, file, false);
		} else if ("OR" in query && negate) {
			return queryHandler.handleAnd(query.OR, file, true);
		} else if ("NOT" in query) {
			// get the filter inside NOT clause
			// return a negation of the filter
			return queryHandler.handleNot(query.NOT, file, negate);
		} else if ("IS" in query) {
			// check if field key correct and no asterisk in middle
			// return sections which fit the statement
			return queryHandler.handleStringComp(query.IS, file, negate);
		} else {
			let sign: string = "";
			for (const comparison of mathComps) {
				if (comparison in query) {
					sign = comparison;
					break;
				}
			}

			if (sign === "") {
				// filter key is invalid (none of above)
				console.log("Filter key is invalid");
				throw new InsightError("Error. Filter key is invalid");
			}

			return queryHandler.handleMathComp(query[sign], sign, file, negate);
		}
	}

	private handleOr(query: any, file: string, negate: boolean): Section[] {
		if (query === undefined) {
			console.log("OR must be a non-empty array");
			throw new InsightError("Error. OR must be a non-empty array");
		} else {
			let fitSections: Section[] = [];

			for (const filter of query) {
				let returned = this.handleWhere(filter, file, negate);
				for (const section of returned) {
					if (fitSections.find((sec) => sec.uuid === section.uuid) === undefined) {
						fitSections.push(section);
					}
				}
			}
			return fitSections;
		}
	}

	private handleAnd(query: any, file: string, negate: boolean): Section[] {
		if (query === undefined) {
			console.log("AND must be a non-empty array");
			throw new InsightError("Error. AND must be a non-empty array");
		} else {
			let fitSections: Section[] = [];
			let filteredSections: string = file;

			for (const filter of query) {
				let returned = this.handleWhere(filter, filteredSections, negate);
				fitSections = returned;
				const serializedSections: string = returned.map((section) => JSON.stringify(section)).join(",");
				filteredSections = `[${serializedSections}]`;
			}
			return fitSections;
		}
	}

	private handleNot(query: any, file: string, negate: boolean): Section[] {
		// check if only one filter
		if (Array.isArray(query)) {
			console.log("need to have exactly one filter");
			throw new InsightError("Error. NOT need to have exactly one filter");
		}

		return this.handleWhere(query, file, !negate);
	}

	private handleStringComp(query: any, file: string, negate: boolean): Section[] {
		// check if only one condition
		if (Array.isArray(query)) {
			console.log("need to have exactly one condition");
			throw new InsightError("Error. scomp need to have exactly one condition");
		}
		const fields: string[] = ["dept", "id", "instructor", "title", "uuid"];
		const key = Object.keys(query)[0];
		const [, field] = key.split("_");
		// check if field is valid
		if (!fields.includes(field)) {
			console.log("Error. invalid string comp field");
			throw new InsightError("Error. invalid string comp field");
		}
		// check if input is string
		if (typeof query[key] !== "string") {
			console.log("string comp input is not a string");
			throw new InsightError("Error. scomp input is not string");
		}
		// check if input has asterisk in the middle
		const regex = /^[*]?[^*]*[*]?$/;
		// console.log(query[key]);
		if (!regex.test(query[key])) {
			console.log("string comp has asterisk in the middle");
			throw new InsightError("Error. scomp input is invalid");
		}

		let validSections: Section[] = [];
		const fileData = JSON.parse(file);
		// turn the input into regex
		const regexString = query[key].replace(/\*/g, ".*");
		const regexInpt = new RegExp(`^${regexString}$`);

		console.log(regexInpt);
		if (negate) {
			for (const section of fileData) {
				if (!regexInpt.test(section[field])) {
					validSections.push(new Section(section.uuid, section.id, section.title,
						section.instructor, section.dept, section.year, section.avg, section.pass,
						section.fail, section.audit));
				}
			}
		} else {
			for (const section of fileData) {
				if (regexInpt.test(section[field])) {
					validSections.push(new Section(section.uuid, section.id, section.title,
						section.instructor, section.dept, section.year, section.avg, section.pass,
						section.fail, section.audit));
				}
			}
		}
		// console.log(validSections);
		return validSections;
	}

	private handleMathComp(query: any, sign: any, file: string, negate: boolean): Section[] {
		// check if only one condition
		if (Array.isArray(query)) {
			console.log("need to have exactly one condition");
			throw new InsightError("Error. mcomp need to have exactly one condition");
		}

		const fields: string[] = ["avg", "pass", "fail", "audit", "year"];
		const key = Object.keys(query)[0];
		const [, field] = key.split("_");
		// check if field is valid
		if (!fields.includes(field)) {
			console.log("Error. invalid math comp field");
			throw new InsightError("Error. invalid math comp field");
		}
		// check if input is number
		if (isNaN(query[key])) {
			console.log("math comp input is not a number");
			throw new InsightError("Error. mcomp input is not a number");
		}

		const fileData = JSON.parse(file);

		return this.processMathNegate(negate, sign, fileData, field, query[key]);

	}

	private processMathNegate(negate: boolean, sign: any, fileData: any, field: string, query_key: any): Section[] {
		let validSections: Section[] = [];
		if (negate) {
			validSections = this.mathNegated(sign, fileData, field, query_key);
		} else {
			if (sign === "GT") {
				for (const section of fileData) {
					if (section[field] > query_key) {
						validSections.push(new Section(section.uuid, section.id, section.title,
							section.instructor, section.dept, section.year, section.avg, section.pass,
							section.fail, section.audit));
					}
				}
			} else if (sign === "LT") {
				for (const section of fileData) {
					if (section[field] < query_key) {
						validSections.push(new Section(section.uuid, section.id, section.title,
							section.instructor, section.dept, section.year, section.avg, section.pass,
							section.fail, section.audit));
					}
				}
			} else {
				for (const section of fileData) {
					if (section[field] === query_key) {
						validSections.push(new Section(section.uuid, section.id, section.title,
							section.instructor, section.dept, section.year, section.avg, section.pass,
							section.fail, section.audit));
					}
				}
			}
		}

		return validSections;
	}

	private mathNegated(sign: any, fileData: any, field: string, query_key: any): Section[] {
		let validSections: Section[] = [];
		if (sign === "GT") {
			for (const section of fileData) {
				if (section[field] < query_key || section[field] === query_key) {
					validSections.push(new Section(section.uuid, section.id, section.title,
						section.instructor, section.dept, section.year, section.avg, section.pass,
						section.fail, section.audit));
				}
			}
		} else if (sign === "LT") {
			for (const section of fileData) {
				if (section[field] > query_key || section[field] === query_key) {
					validSections.push(new Section(section.uuid, section.id, section.title,
						section.instructor, section.dept, section.year, section.avg, section.pass,
						section.fail, section.audit));
				}
			}
		} else {
			for (const section of fileData) {
				if (section[field] !== query_key) {
					validSections.push(new Section(section.uuid, section.id, section.title,
						section.instructor, section.dept, section.year, section.avg, section.pass,
						section.fail, section.audit));
				}
			}
		}
		return validSections;
	}

// helper function to handle OPTION clause
	public handleOption(query: any, results: Section[]): InsightResult[] {
		// make sure to throw insightError when ORDER key is not in COLUMN (see test invalid/order_not_key_in_column.json)
		// eric note: i believe the order does not matter when order key is not in column (no insighterror)

		// checks to see if query is too large
		if (results.length > 5000) {
			throw new ResultTooLargeError("more than 5000 reults");
		}

		let OUTPUT = [];

		// gets columns strings
		let COLUMN_STRING = query.COLUMNS;

		// gets order string if available
		let ORDER_OPTION = query.ORDER;

		for (let i in query) {
			if (i !== "ORDER" && i !== "COLUMNS") {
				throw new InsightError("Invalid key");
			}
			// console.log("here1: " + i);
			// console.log("here2: " + query[i]);
		}


		// console.log("here: " + FIRST_PREFIX);

		let VALID_STRINGS = ["uuid","id", "title","instructor","dept","year","avg","pass","fail","audit"];

		let CURR_STRINGS = [];

		// checks to see if id field is valid in query
		for (let c in COLUMN_STRING) {
			// console.log("here c: "+ c);
			// console.log("here: "+ COLUMN_STRING[c]);z

			// gets the first part of prefix
			let FIRST_PREFIX = COLUMN_STRING[c].slice(COLUMN_STRING[c].indexOf("_") + 1);

			CURR_STRINGS.push(FIRST_PREFIX);
			if (!(VALID_STRINGS.includes(FIRST_PREFIX))) {
				throw new InsightError("Invalid field");
			}
		}


		// checks to see if order is formatted properly
		if((ORDER_OPTION !== undefined) && !(CURR_STRINGS.includes(ORDER_OPTION.slice(ORDER_OPTION.indexOf("_") + 1)))){
			throw new InsightError("Invalid order option");
		}


		for (let section in results) {
			let TO_ADD: InsightResult = {};
			for (let c in COLUMN_STRING) {
				// gets column to add
				let CURR_COLUMN = COLUMN_STRING[c];
				// console.log("AHHHH! " + COLUMN_STRING[c]);

				let CURR_NAME = "";

				CURR_NAME = CURR_COLUMN.substring(CURR_COLUMN.indexOf("_") + 1);

				// console.log("AHHHH2! " + (results[section] as any)[CURR_NAME]);

				TO_ADD[CURR_COLUMN] = (results[section] as any)[CURR_NAME];

				// console.log("AHHHH4! " + (JSON.stringify(results[section])));
				// console.log("AHHHH2! " + results[section]);
			}
			OUTPUT.push(TO_ADD);
		}

		if (!(ORDER_OPTION === undefined)) {
			OUTPUT.sort((a, b) => {
				let A_FIRST = a[ORDER_OPTION];
				let B_FIRST = b[ORDER_OPTION];

				if (A_FIRST > B_FIRST) {
					return 1;
				} else if
				(A_FIRST < B_FIRST) {
					return -1;
				}

				return 1;
			});
		}

		// console.log(OUTPUT);

		return OUTPUT; // stub
	}

}
