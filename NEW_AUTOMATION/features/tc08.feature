Feature: TC08 New member registration and login
  As a new traveller
  I want to sign up with a temporary email, verify it, and log in
  So that I can use my new membership account

  @TC08 @smoke @signup @login
  Scenario: TC08 - Sign up via Yopmail, verify email, and log in
    Given the application home page is open
    When I open the login modal
    And I start sign up from the login modal
    And I generate a temporary email via Yopmail
    And I complete new account registration with that email
    And I verify the account from the Yopmail activation email
    And I log in with the newly registered credentials
    Then I should be logged in
