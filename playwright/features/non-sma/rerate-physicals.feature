@non-sma @rerate @physicals
Feature: Non-SMA Physicals rerate

  Background:
    Given I am logged into Financing GO as "regressionUser"
    And I load test data "rerate.nonSma.physicals"

  Scenario: Create and approve a Non-SMA Physicals rerate request
    When I open Create Pricing/Config
    And I select account type "Non-SMA"
    And I select request type "Rerate"
    And I select request for "Add New Pricing"
    And I select client type "PB"
    And I select the following products:
      | Physicals |
    And I select the following configurations:
      | Credit |
      | Debit |
      | ABF |
      | GC Shorts (Cash) |
      | Credit Short |
      | Trade Clearing & Other Fees |
    And I set effective from to "today"
    And I select client domicile "Americas"
    And I enter primary sales person "sril" and select "Thumati, Srilatha [GBM Public]"
    And I select EQM region "Americas"
    And I enter CS coverage "sril" and select "Thumati, Srilatha [GBM Public]"
    And I open the Client tab
    And I select pricing type "Fund Manager"
    And I enter fund manager "gsec tes" and select "1200118674 | GSEC TEST"
    And I open the "Credit" tab
    And I get rate data
    And I set the default benchmark spread to "10"
    And I open the "Debit" tab
    And I set the default benchmark spread to "10"
    And I open the "ABF" tab
    And I fill the ABF hierarchy from the test data
    And I open the "GC Shorts (Cash)" tab
    And I set Americas DM GC rate to "20"
    And I open the "Credit Short" tab
    And I pick the first available date
    And I open the "Trade Clearing & Other Fees" tab
    And I select default schedule "Standard International"
    And I apply the request
    And I get account setup data
    And I validate the request
    Then I should see no validation issues
    When I submit the request for approval
    And I open the created request
    And I wait for the Perform EQM Approval action
    And I perform EQM approval with comment "approve"
    Then the request should progress past pending EQM approval
