import Principal "mo:base/Principal";
import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";
import HashMap "mo:base/HashMap";
import NFTActorClass "../NFT/nft";
import List "mo:base/List";
import Iter "mo:base/Iter";

actor OpenD {

  //custom data type
  private type Listing = {
    itemOwner : Principal;
    itemPrice : Nat;
  };

  //principal.equal to check the key eqaulity and then principal.hash to has those keys
  var mapOfNFT = HashMap.HashMap<Principal, NFTActorClass.NFT>(1, Principal.equal, Principal.hash);
  //now each owner can have several NFT so we will map it with list
  var mapOfOwner = HashMap.HashMap<Principal, List.List<Principal>>(1, Principal.equal, Principal.hash);
  //Principal mapped with custom data type to store the value of owner id future - history date stamp
  var mapOfListings = HashMap.HashMap<Principal, Listing>(1, Principal.equal, Principal.hash);

  public shared (msg) func mint(imgData : [Nat8], name : Text) : async Principal {
    let owner : Principal = msg.caller;

    //we need to add cycles as well while creating new canister
    // this will add this no of cycles from main canister and gets allocated for the new canister
    Debug.print(debug_show (Cycles.balance()));
    Cycles.add(100_500_000_000);
    //initialise new NFT canister
    let newNFT = await NFTActorClass.NFT(name, owner, imgData);
    Debug.print(debug_show (Cycles.balance()));
    let newNFTPrincipal = await newNFT.getCanisterId();

    mapOfNFT.put(newNFTPrincipal, newNFT);
    addOwnershipMap(owner, newNFTPrincipal);

    return newNFTPrincipal;
  };

  private func addOwnershipMap(owner : Principal, nftid : Principal) {
    //whileworking with get and put we need to consider null check
    var ownedNFT : List.List<Principal> = switch (mapOfOwner.get(owner)) {
      case null List.nil<Principal>();
      case (?result) result;
    };
    ownedNFT := List.push(nftid, ownedNFT);
    mapOfOwner.put(owner, ownedNFT);
  };

  public query func getOwnedNFTs(user : Principal) : async [Principal] {
    var ownedNFT : List.List<Principal> = switch (mapOfOwner.get(user)) {
      case null List.nil<Principal>();
      case (?result) result;
    };
    return List.toArray(ownedNFT);
  };

  public query func getListedNFTs() : async [Principal] {
    let ids = Iter.toArray(mapOfListings.keys());
    return ids;
  };

  //id of nft which is listed
  public shared (msg) func listItem(id : Principal, price : Nat) : async Text {

    //get NFT from id
    var item : NFTActorClass.NFT = switch (mapOfNFT.get(id)) {
      case null return "NFT does not exsist.";
      case (?result) result;
    };

    //check if only owner of NFT is calling this
    let owner = await item.getOwner();

    if (Principal.equal(owner, msg.caller)) {
      let newListingItem : Listing = {
        itemOwner = owner;
        itemPrice = price;
      };
      mapOfListings.put(id, newListingItem);
      return "Success";

    } else {
      return "You don't Own the NFT";
    };

    return "Success";
  };

  //getting canisterID of Opend canister
  public query func getOpenDCanisterID() : async Principal {
    return Principal.fromActor(OpenD);
  };

  public query func isListed(id : Principal) : async Bool {
    Debug.print("isListed Called");
    if (mapOfListings.get(id) == null) {
      return false;
    } else {
      return true;
    };
  };

  public query func getOrignalOwner(id : Principal) : async Principal {
    var listing : Listing = switch (mapOfListings.get(id)) {
      case null return Principal.fromText("aaaaa-aa"); //managment canister principal id
      case (?result) result;
    };
    return listing.itemOwner;
  };

  public query func getListedNFTPrice(id : Principal) : async Nat {
    var listing : Listing = switch (mapOfListings.get(id)) {
      case null return 0;
      case (?result) result;
    };
    return listing.itemPrice;
  };

  public shared (msg) func completePurchase(id : Principal, ownerId : Principal, newOwnerId : Principal) : async Text {

    var purchasedNFT : NFTActorClass.NFT = switch (mapOfNFT.get(id)) {
      case null return "NFT does not exsist";
      case (?result) result;
    };

    let transferResult = await purchasedNFT.transferOwnerShip(newOwnerId);
    if (transferResult == "Success") {
      //remove from listed NFT
      mapOfListings.delete(id);
      //remove from owners owned NFT
      var ownedNFTs : List.List<Principal> = switch (mapOfOwner.get(ownerId)) {
        case null List.nil<Principal>();
        case (?result) result;
      };

      //filter in list return new list for which given function is true
      ownedNFTs := List.filter(
        ownedNFTs,
        func(listItemId : Principal) : Bool {
          return listItemId != id;
        },
      );

      addOwnershipMap(newOwnerId, id);
      return "Success";
    } else {
      return "Error";
    };

  };

};
