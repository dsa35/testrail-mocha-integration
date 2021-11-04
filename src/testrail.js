const Testrail = require("testrail-api");
const moment = require("moment");
const _ = require("lodash");
const { logger } = require("./utils");
const getenv = require("getenv");
const chalk = require("chalk");

require("dotenv").config();

function addCiInfo(opts) {
  let reporterOptions = opts;
  if (getenv.bool("CIRCLECI", false)) {
    reporterOptions = {
      ...reporterOptions,
      runName: `${reporterOptions.runName} | #${process.env.CIRCLE_BUILD_NUM}`
    };
  } else if (reporterOptions.ci === "travis") {
    reporterOptions = {
      ...reporterOptions,
      runName: `${reporterOptions.runName} | #${process.env.TRAVIS_BUILD_NUMBER}`
    };
  } else if (reporterOptions.ci === "jenkins") {
    reporterOptions = {
      ...reporterOptions,
      runName: `${reporterOptions.runName} | #${process.env.BUILD_NUMBER}`
    };
  }
  return reporterOptions;
}

function checkOpts(opts) {
  return {
    ...opts,
    domain:
      opts.domain !== undefined
        ? opts.domain
        : getenv("TESTRAIL_DOMAIN", "n/a"),
    username:
      opts.username !== undefined
        ? opts.username
        : getenv("TESTRAIL_USERNAME", "n/a"),
    password:
      opts.password !== undefined
        ? opts.password
        : getenv("TESTRAIL_PASSWORD", "n/a"),
    projectId:
      opts.projectId !== undefined
        ? opts.projectId
        : getenv("TESTRAIL_PROJECT_ID", "n/a"),
    milestoneId:
      opts.milestoneId !== undefined
        ? opts.milestoneId
        : getenv("TESTRAIL_MILESTONE_ID", "n/a"),
    suiteId:
      opts.suiteId !== undefined
        ? opts.suiteId
        : getenv("TESTRAIL_SUITE_ID", "n/a"),
    runId:
      opts.runId !== undefined ? opts.runId : getenv("TESTRAIL_RUN_ID", "n/a"),
    entryId:
      opts.entryId !== undefined ? opts.entryId : getenv("TESTRAIL_ENTRY_ID", "n/a"),
    planId:
      opts.planId !== undefined
        ? opts.planId
        : getenv("TESTRAIL_PLAN_ID", "n/a"),
    configId:
      opts.configId !== undefined
        ? opts.configId
        : getenv("TESTRAIL_CONFIG_ID", "n/a"),
    runName:
      opts.runName !== undefined
        ? opts.runName
        : getenv("TESTRAIL_RUN_NAME", "n/a"),
    createRun:
      opts.createRun !== undefined
        ? opts.createRun
        : getenv("TESTRAIL_CREATE_RUN", false),
    suiteIds:
      opts.suiteIds !== undefined
        ? suiteIds
        : getenv("TESTRAIL_SUITE_IDS", "n/a"),
    ci: opts.ci !== undefined ? opts.ci : getenv("TESTRAIL_CI", "n/a")
  };
}

class TestrailClass {
  constructor(opts) {
    if (Object.keys(opts).length === 0) {
      logger("Missing --reporter-options in mocha.opts");
      process.exit(1);
    }
    opts = checkOpts(opts);
    this.validateOptions(opts);
    if (opts.ci) {
      addCiInfo(opts);
    }
    this.domain = opts.domain;
    this.username = opts.username;
    this.password = opts.password;
    this.projectId = opts.projectId;
    this.milestoneId = opts.milestoneId;
    this.planId = opts.planId;
    this.createRun = opts.createRun;
    this.configId = opts.configId;
    this.runId = opts.runId;
    this.entryId = opts.entryId;
    this.suiteId = opts.suiteId;
    this.runName = opts.runName;
    this.suiteIds = opts.suiteIds;
    this.testrail = new Testrail({
      host: `https://${this.domain}`,
      user: this.username,
      password: this.password
    });
  }

  validateOptions(options) {
    this.validateSingleOpt(options, "domain");
    this.validateSingleOpt(options, "username");
    this.validateSingleOpt(options, "password");
    this.validateSingleOpt(options, "projectId");
    if (this.milestoneId !== "n/a") {
      this.validateSingleOpt(options, "milestoneId");
    }
    if (this.planId !== "n/a") {
      this.validateSingleOpt(options, "planId");
      this.validateSingleOpt(options, "configId");
    } else if (this.runId !== "n/a") {
      this.validateSingleOpt(options, "runId");
      this.validateOptions(options, "entryId");
      this.validateSingleOpt(options, "suiteId");
    } else if (this.createRun !== "n/a") {
      this.validateSingleOpt(options, "createRun");
      this.validateSingleOpt(options, "runName");
      this.validateSingleOpt(options, "suiteId");
    } else {
      logger(
        "Missing values in opts. There are three options:\n\t planId\n\t runId + suiteId\n\t createRun + runName + suiteId"
      );
    }
  }

  validateSingleOpt(options, name) {
    if (options[name] == null) {
      logger(
        `Missing ${chalk.red(
          name.toUpperCase()
        )} value. Please update --reporter-options in mocha.opts`
      );
      process.exit(1);
    }
  }

  // todo finish create run
  async createPlan() {
    return await this.testrail.addPlan(this.projectId, {
      name: "[#ccid - test plan]",
      milestone_id: this.milestone_id,
      entries: [
        { suite_id: 24, name: "[#ccid] - test suite config" },
        { suite_id: 25, name: "[#ccid] - test suite - user" }
      ]
    });
  }

  async getRunIdTestCase(caseId) {
    try {
      const planResponse = await this.testrail.getPlan(this.planId);
      try {
        const caseResponse = await this.testrail.getCase(caseId);
        const tcSuiteId = _.get(caseResponse.body, "suite_id");
        const planRunId = _.chain(
          _.find(planResponse.body.entries, e => e.suite_id === tcSuiteId)
        )
          .get("runs")
          .head()
          .get("id")
          .value();
        return planRunId;
      } catch (error) {
        logger(
          `Error when trying to get ${chalk.red(
            `testCase ${testCase}`
          )} from TR api`
        );
        logger(`${error.stack}`);
      }
    } catch (error) {
      logger(
        `Error when trying to get testPlan with ${chalk.red(
          `planId ${this.planId}`
        )} from TR api`
      );
      logger(`${error.stack}`);
    }
  }

  async createNewRun() {
    logger(
      `Creating run ${this.runName} - ${moment().format(
        "YYYY MMM DD, HH:MM:SS"
      )}`
    );

    let createBody = {
      name: `${this.runName} | ${moment().format("YYYY MMM DD, HH:MM:SS")}`,
      suite_id: this.suiteId,
      // to review if it makes sense to keep include all = true
      include_all: true
    };
    if (this.milestoneId !== "n/a" && this.milestoneId !== 0) {
      createBody = {
        ...createBody,
        milestone_id: this.milestoneId
      };
    }
    try {
      const addRunResponse = await this.testrail.addRun(
        this.projectId,
        createBody
      );
      logger(`Created run with ID ${addRunResponse.body.id}`);
      return addRunResponse.body.id;
    } catch (error) {
      logger("Error when creating a test Run");
      logger(error);
      return 0;
    }
  }

  async updateCases(planId, runId, entryId, results) {
    try {
      const tests = await this.testrail.getTests(runId);
      let cases = [];

      // populate array with existing test cases in the run
      tests.body.forEach((obj) => cases.push(obj.case_id));

      // add tests from current execution to array
      results.forEach((obj) => cases.push(obj.case_id));

      const body = {
        include_all: false,
        case_ids: cases
      }

      // update test run entry with existing tests + tests from current execution
      const result = await this.testrail.updatePlanEntry(planId, entryId, body);
      logger(body);
      logger(result);

    } catch (error) {
        logger("Error updating tests");
        logger(error);
    }

  }

  getCasesFromResults(results) {
    let cases = [];
    results.forEach((obj) => cases.push(obj.case_id));
    
    return cases
  }

  async createPlanRun(results) {
    const cases = getCasesFromResults(results);

    const body = {
      suite_id: this.suiteId,
      name: this.runName,
      include_all: true,
      config_ids: [this.configId],
      runs: [
        {
          include_all: false,
          case_ids: cases,
          config_ids: [this.configId]
        }
      ]
    };

    try {
      const addRunResponse = await this.testrail.addPlanEntry(this.planId, body);

      logger(`Created run with ID ${addRunResponse.body.runs[0].id}`);
      
      return addRunResponse.body.runs[0].id;
    } catch (error) {
        logger("Error when creating a test Run");
        logger(error);

        return 0;
    }
  }

  async closeRun(runId) {
    try {
      logger(`Closing run with id ${runId}`);
      await this.testrail.closeRun(runId);
    } catch (error) {
      logger(`Could not close the run with id ${runId}`);
    }
  }

  filterResults(results) {
    // filter case_ids with more than one occurrence and containing results != passed, then change those cases to a common result following the order untestest/failed/passed
    results.forEach((x) => {
        const filteredResults = results.filter(e => e.case_id === x.case_id);

        if ((filteredResults.length > 1) && (filteredResults.filter(e => e.status_id === 4).length > 0))
            x.status_id = 4;
        else if ((filteredResults.length > 1) && (filteredResults.filter(e => e.status_id === 11).length > 0))
            x.status_id = 11;

    });

    return results;
  };

  async addResults(runId, results) {
    try {
      results = this.filterResults(results);
      logger(`Adding results to run with id ${runId}`);
      await this.testrail.addResultsForCases(runId, results ? results : {});
      logger(
        `Results published to https://${this.domain}/index.php?/runs/view/${runId}`
      );
    } catch (err) {
      logger(
        `
        Adding results failed with err
        ${err}
        `
      );
      throw new Error(`${err}`);
    }
  }

  async sendResults(results, failures, exit) {
    let runId = 0;
    logger("Plan ID: " + this.planId);
    logger("Run ID: " + this.runId);
    if ((this.planId !== "n/a") && (this.runId === "n/a")) {
      runId = await this.createPlanRun(results)
    }
    else if (this.runId !== "n/a") {
      runId = this.runId;
      await this.updateCases(this.planId, runId, this.entryId, results);
    }
    else {
      runId = await this.createNewRun();
    }

    if (runId === "0" || runId === 0 || runId === "n/a") {
      logger("Invalid RunID");
      exit && exit(failures > 0 ? 1 : 0);
    }
    else {
      await this.addResults(runId, results);
      exit && exit(failures > 0 ? 1 : 0);
    }
  }
}

module.exports = TestrailClass;
