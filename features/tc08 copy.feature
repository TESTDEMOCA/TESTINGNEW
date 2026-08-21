Feature: TC08 New member registration and login
  As a new traveller
  I want to sign up with a temporary email, verify it, and log in
  So that I can use my new membership account

  @TC08
  Scenario: TC08 - 
    Given the application home page is open
    When I select currency "HKD"
    When I search Book Now for "HKG" until Book Now is available
    And I click Book Now arrow on the Book Now widget
    And I click Check Out on Book Now flow
    And I start sign up from the login modal after selecting a product
    And I generate a temporary email via Yopmail
    And I complete new account registration with the generated Email after product selection
    And I verify the account from the Yopmail activation email
    And I open the login modal at checkout page
    And I log in with the newly registered credentials
    And I complete member checkout for TC02
    And I click Confirm and Proceed for Book Now member flow
    Then I should reach payment, save card for future, and confirm booking for member flow
    And the booking order number should be captured
    And I should see the captured booking in LMS Bookings
