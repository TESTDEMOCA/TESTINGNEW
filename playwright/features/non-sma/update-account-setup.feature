@non-sma @update-account-setup @physicals
Feature: Non-SMA Update Account Setup

  Background:
    Given I am logged into Financing GO as "regressionUser"
    And I load test data "updateAccountSetup.nonSma"

  Scenario: Create and approve a Non-SMA Update Account Setup request
    When I open Create Pricing/Config
    And I select account type "Non-SMA"
    And I select request type "Update Account Setup"
    And I select request for "Add New Pricing"
    And I select client type "PB"
    And I select the following products:
      | Physicals |
    And I set EQM approval required to "Yes"
    And I set effective from to "today"
    And I select client domicile "Americas"
    And I select EQM region "Americas"
    And I enter primary sales person "sril" and select "Thumati, Srilatha [GBM Public]"
    And I enter optional CS coverage "sril" and select "Thumati, Srilatha [GBM Public]"
    And I open the Client tab
    And I select pricing type "Fund Manager"
    And I enter fund manager "gsec tes" and select "1200118674 | GSEC TEST"
    And I get account setup data
    And I validate the request
    Then I should see no validation issues
    When I submit the request for approval
    And I open the created request
    And I wait for the Perform EQM Approval action
    And I perform EQM approval with comment "approve"
    Then the request should progress past pending EQM approval
