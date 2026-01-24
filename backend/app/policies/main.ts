/*
|--------------------------------------------------------------------------
| Bouncer policies
|--------------------------------------------------------------------------
|
| You may define a collection of policies inside this file and pre-register
| them when creating a new bouncer instance.
|
| Pre-registered policies and abilities can be referenced as a string by their
| name. Also they are must if want to perform authorization inside Edge
| templates.
|
*/

export const policies = {
  OrganizationPolicy: () => import('#policies/organization_policy'),
  InvitationPolicy: () => import('#policies/invitation_policy'),
  GdprPolicy: () => import('#policies/gdpr_policy'),
  ResellerPolicy: () => import('#policies/reseller_policy'),
  ResellerOrganizationPolicy: () => import('#policies/reseller_organization_policy'),
  CreditPolicy: () => import('#policies/credit_policy'),
  CreditRequestPolicy: () => import('#policies/credit_request_policy'),
}
