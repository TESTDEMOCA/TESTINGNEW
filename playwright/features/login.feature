@login
Feature: Financing GO login

  Scenario: Regression user reaches the dashboard
    Given I open the Financing GO login page
    When I log in as "regressionUser"
    Then I should see the Financing GO dashboard
    And I should see the dashboard primary navigation
