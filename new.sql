CREATE OR REPLACE FUNCTION users."isSellerOrderableForBuyer"( params jsonb, hasura_session json)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
sellerId text := params->>'sellerId';
buyerId text := hasura_session->>'x-hasura-buyer-id';


BEGIN

if exists(select 1 from brands."getBuyerCatalogue3"('buyerId', jsonb_build_object('entityType', 'seller', 'sellerId', sellerId)))
then true; 
else false; 
end if; 

return results;

END
$function$