UPDATE "Participant" SET "bibCollected" = true, "tshirtCollected" = true, "goodiesCollected" = true WHERE "collectionStatus" IN ('Collected', 'Collected_By_Behalf');
