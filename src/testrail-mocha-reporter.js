const TestrailClass = require("./testrail");
const Mocha = require("mocha");
const { EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS, EVENT_TEST_PENDING } =
  Mocha.Runner.constants;
const { titleToCaseIds, logger } = require("./utils");
const getenv = require("getenv");

require("dotenv").config();

function getResultBody(test, caseId) {
  const duration = test.duration === undefined ? 'n/a' : `${test.duration} ms` ;
  let comment = `State: ${test.state} | Duration: ${duration}`;
  if (getenv.bool("CIRCLECI", false)) {
    comment = `
      ${comment}
      Circle build URL - ${getenv("CIRCLE_BUILD_URL", "n/a")}
      Circle Branch - ${getenv("CIRCLE_BRANCH", "n/a")}
      Author - ${getenv("CIRCLE_USERNAME", "n/a")}
      Github - ${getenv("CI_PULL_REQUEST", "n/a")}
    `;
  }
  return {
    case_id: caseId,
    // status id
    // pass automation = 10
    // fail automation = 11
    // untested = 3
    // retest = 4
    //status_id: test.state === "passed" ? 10 : 11,
    status_id: getStateResult(test.state),
    comment,
    elapsed: test.duration,
    version: getenv("TESTRAIL_RESULT_VERSION", "n/a")
  };
}

function getStateResult(state) {
  let result = 3; // untested state
  
  switch (state) {
  case 'passed':
    result = 10; // pass automation state
    break;
  case 'failed':
    result = 11; // fail automation state
    break;
  default:
    result = 4; // retest state
  }

  return result;
}

function consoleReporter(reporter) {
  if (reporter) {
    try {
      // eslint-disable-next-line import/no-dynamic-require
      return require(`mocha/lib/reporters/${reporter}`);
    } catch (e) {
      log(`Unknown console reporter '${reporter}', defaulting to spec`);
    }
  }

  return require("mocha/lib/reporters/spec");
}

async function done(results, testrail, options, failures, exit) {
  try {
    if (results.length === 0) {
      logger(`No results found.`);
      exit && exit(failures > 0 ? 1 : 0);
    } else {
      await testrail.sendResults(results, failures, exit);
    }
  } catch (error) {
    logger(error);
    exit && exit(failures > 0 ? 1 : 0);
  }
}

function getReporterOptions(reporterOptions) {
  return {
    ...reporterOptions
  };
}

function testrailReporter(runner, options) {
  this.results = [];
  // Ensure stats collector has been initialized
  if (!runner.stats) {
    const createStatsCollector = require("mocha/lib/stats-collector");
    createStatsCollector(runner);
  }

  // Reporter options
  let reporterOptions = getReporterOptions(options.reporterOptions);

  const testrail = new TestrailClass(reporterOptions);

  // Done function will be called before mocha exits
  // This is where we will save JSON and generate the HTML report
  this.done = (failures, exit) =>
    done(this.results, testrail, reporterOptions, failures, exit);

  // Call the Base mocha reporter
  Mocha.reporters.Base.call(this, runner);

  const reporterName = reporterOptions.consoleReporter;
  if (reporterName !== "none") {
    const ConsoleReporter = consoleReporter(reporterName);
    new ConsoleReporter(runner); // eslint-disable-line
  }

  let endCalled = false;

  runner.on(EVENT_TEST_PASS, test => {
    const caseIds = titleToCaseIds(test.title);
    if (caseIds.length > 0) {
      const results = caseIds.map(caseId => {
        return getResultBody(test, caseId);
      });
      this.results.push(...results);
    } else {
      logger(
        `No test case found. In order to be published to Testrail please check naming - must include TR-xxxx`
      );
    }
  });

  runner.on(EVENT_TEST_FAIL, test => {
    const caseIds = titleToCaseIds(test.title);
    if (caseIds.length > 0) {
      const results = caseIds.map(caseId => {
        return getResultBody(test, caseId);
      });
      this.results.push(...results);
    } else {
      logger(
        `No test case found. In order to be published to Testrail please check naming - must include TR-xxxx`
      );
    }
  });

  runner.on(EVENT_TEST_PENDING, test => {
    const caseIds = titleToCaseIds(test.title);
    if (caseIds.length > 0) {
      const results = caseIds.map(caseId => {
        return getResultBody(test, caseId);
      });
      this.results.push(...results);
    } else {
      logger(
        `No test case found. In order to be published to Testrail please check naming - must include TR-xxxx`
      );
    }
  });

  // Process the full suite
  runner.on(EVENT_RUN_END, () => {
    try {
      if (!endCalled) {
        // end gets called more than once for some reason
        // so we ensure the suite is processed only once
        endCalled = true;

        const { failures } = this.stats;
        this.failures = failures;
      }
    } catch (e) {
      logger(`Problem with testrail reporter: ${e.stack}`);
    }
  });
}

module.exports = testrailReporter;
