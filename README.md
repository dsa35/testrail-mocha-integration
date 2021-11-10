# testrail-mocha-integration

Another custom mocha reporter for use with javascript framework, [mocha](https://mochajs.org/).

Forked from https://github.com/hermape7/testrail-mocha-reporter

## Installation

### npm

```Bash
npm install @dsa35/testrail-mocha-integration
```

### via package.json

```Bash
"@dsa35/testrail-mocha-integration": "0.6.5"
```

## Usage example

### Mocha

```bash
mocha test --reporter testrail-mocha-integration --reporter-options domain=testrail.domain.com,username=email@domain.com,password=<api_key>,projectId=89,planId=84832,suiteId=8498,runName=Automated,configId=685
```
where:

**domain**: *string* domain name of your Testrail instance (e.g. for a hosted instance instance.testrail.net)

**username**: *string* user under which the test run will be created (e.g. jenkins or ci)

**password**: *string* use API key generated under user settings in Testrail

**projectId**: *number* project id in use for the your in Testrail

**planId**: *number* planId should be previously created and will be used to store every new run/tests

**suiteId**: *number* test suite number where the tests are located

**runName**: *string* run name that will be created inside the test plan

**configId**: *number* config number that will be used to identify device/source executing tests (e.g.: Roku 4200x), should be retrieved from Testrail configs


### Cypress integration

Reporter also working with [Cypress.io](https://www.cypress.io/).

To integrate reporter please read Cypress [documentation](https://docs.cypress.io/guides/tooling/reporters.html) on how to add custom reporters.

### Add reporter to json cypress.json

```json
{
  ...,
  "reporter": "testrail-mocha-reporter",
  "reporterOptions": {
    "domain": "domain.testrail.com",
    "username": "test@test.com",
    "password": "<api_key>",
    "projectId": 1,  
    "planId": 1,
    ...
  },
  ...
}
```

If you are using a `multi-custom-reporter` then you will need to add it like this: 

```json
{
  ...,
  "reporterOptions": {
    "reporterEnabled": "testrail-mocha-reporter,html",
    "testrailMochaReporterReporterOptions": {
      "domain": "domain.testrail.com",
      "username": "test@test.com",
      "password": "<api_key>",
      "projectId": 1,  
      "planId": 1,
      ...
    }
  },
  ...
}

```

### Mapping Testrail cases with scenarios in the code

Include test case id from Testrail inside `it` with the following format: `TR-123456`, reporter will get the id `123456` from Testrail and create an execution for the given test case inside the test plan/run id with status `Pass automation` or `Fail automation` accordingly.

```
describe('Authentication Feature', () => {
    it('TR-123456 - Authentication with empty email', async function () {
        await authentication.loginWithEmptyEmail();
        await authentication.validateEmptyEmailError();
    });

});
```

```
describe('TC4.4.3 - Search - Results begin to populate as the user is typing the search criteria', () => {
    it('TR-123456 - should display a grid of contents on Results and Clips tab', () => {
        cy.moveToSearchFilter();
        ...
    });
});
```

## References

* <https://github.com/adamgruber/mochawesome#readme>
* <http://mochajs.org/#mochaopts>
* <https://github.com/mochajs/mocha/wiki/Third-party-reporters>
* <http://docs.gurock.com/testrail-api2/start>
