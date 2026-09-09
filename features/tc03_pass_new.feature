Feature: TC03 Smart Traveller Pass Booking (login first)
  As a newly registered Smart Traveller
  I want to sign up and log in first, then book a Smart Traveller–only pass
  So that checkout works with an already authenticated member session

  @TC03_pass_new
  Scenario: TC03_pass_new - Login first then Smart Traveller pass checkout
    # --- TC08: register + verify + login ---
    Given the application home page is open
    When I open the login modal
    And I start sign up from the login modal
    And I generate a temporary email via Yopmail
    And I complete new account registration with that email
    And I verify the account from the Yopmail activation email
    And I log in with the newly registered credentials
    Then I should be logged in

    # --- Already logged in: Smart Traveller pass + checkout ---
    When I select currency "HKD"
    And I click on the Passes on the top menu
    Then I select the member only pass from the list of passes
    And I click Check Out on Book Now flow
    And I complete member checkout for TC02
    And I click Confirm and Proceed for Book Now member flow
    Then I should reach payment and confirm booking for Book Now flow
    And I verify Confirmation page should be displayed with the same product and price that the customer has paid and purchased
    And I redirect to Yopmail and refresh the inbox
    And I should receive a Plaza Premium Lounge Booking Confirmation email in Yopmail with the captured booking id
