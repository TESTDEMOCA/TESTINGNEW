Feature: Home navigation
  As a guest
  I want to open key site links
  So that I can reach Passes and Group Booking

  @regression @QA-3
  Scenario Outline: Navigate to a public menu after home loads
    Given the application home page is open
    Then the home page should be visible
    When I navigate to the "<menu>" menu

    Examples:
      | menu                   |
      | Group Booking          |
      | Passes & Memberships   |
