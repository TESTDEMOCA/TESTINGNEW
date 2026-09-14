Feature: Plaza Premium Lounge home
  As a guest
  I want to open the PPL staging home page
  So that I can search for lounges

  @smoke @QA-1
  Scenario: Smoke - Home page and search widget load
    Given the application home page is open
    Then the home page should be visible
    And the lounge search widget should be visible

  @smoke @search
  Scenario: Smoke - Search lounges by city
    Given the application home page is open
    When I search for lounges in "London"
    Then the home page should be visible
