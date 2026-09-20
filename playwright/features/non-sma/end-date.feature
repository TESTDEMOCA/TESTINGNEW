@non-sma @end-date
Feature: Non-SMA End Date

  Background:
    Given I am logged into Financing GO as "regressionUser"
    And I load test data "endDate.nonSma"

  Scenario: Create and approve a Non-SMA End Date request
    When I open Create Pricing/Config
    And I select account type "Non-SMA"
    And I select request type "End Date"
    And I set the end date to "today"
    And I open the Client tab
    And I select pricing type "Fund Manager"
    And I enter fund manager "gsec tes" and select "1200118674 | GSEC TEST"
    And I select the client fund "GSEC TEST"
    And I validate the request
    Then I should see no validation issues
    When I submit the request for approval
    And I open the created request
    And I wait for the Perform EQM Approval action
    And I perform EQM approval with comment "approve"
    Then the request should progress past pending EQM approval
