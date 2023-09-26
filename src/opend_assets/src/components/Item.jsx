import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../declarations/nft/nft.did.js";
import { idlFactory as tokenIdlFactory } from "../../../declarations/token/token.did.js";
import { Principal } from "@dfinity/principal";
import Button from "./Button";
import { opend } from "../../../declarations/opend";
import CURRENT_USER_ID from "../index";
import PriceLabel from "./PriceLabel";

function Item(props) {

  const [name, setName] = useState();
  const [owner, setOwner] = useState();
  const [image, setImage] = useState();
  const [button, setButton] = useState();
  const [priceInput, setPriceInput] = useState();
  const [blur, setblur] = useState();
  const [sellStatus, setSellStatus] = useState("");
  const [priceLabel, setPriceLabel] = useState();
  const [shouldDisplay, setDisplay] = useState(true);

  console.log("Parth");
  const id = props.id;
  console.log(id);
  // we will use HTTP to fetch that canister which we deployed from the command line on ic.
  const localHost = "http://localhost:8080/";
  const agent = new HttpAgent({ host: localHost });
  //TODO : remove this While deploying code to IC
  agent.fetchRootKey();

  let NFTActor;
  async function loadNFT() {
    //importing idle factor along this which gives translated version of motoko backend to the frontend 
    NFTActor = await Actor.createActor(idlFactory, {
      agent,
      canisterId: id
    });

    console.log("Parth2");
    const name = await NFTActor.getName();
    const owner = await NFTActor.getOwner();
    const imageData = await NFTActor.getAsset();
    const imageContent = new Uint8Array(imageData);

    //unit 8 byte array to url we will use blob which is used to convert the datatypes.

    const image = URL.createObjectURL(
      new Blob([imageContent.buffer], { type: "image/png" })
    );


    console.log("Parth3");
    setName(name);
    setOwner(owner.toText());
    setImage(image);

    //for my NFT
    if (props.role == "collection") {
      const nftIsListed = await opend.isListed(props.id);
      if (nftIsListed) {
        setOwner("OpendD");
        setblur({ filter: "blur(4px" });
        setSellStatus("Listed");
      }
      else {
        //passing function as props
        setButton(<Button handleClick={handleSell} text={"sell"} />);
      }
    }
    //for discovery page
    else if (props.role == "discover") {
      //to avoid buying NFT listed by the owner
      const orignalOwner = await opend.getOrignalOwner(props.id);
      if (orignalOwner.toText() != CURRENT_USER_ID.toText()) {
        setButton(<Button handleClick={handleBuy} text={"Buy"} />);
      }

      const price = await opend.getListedNFTPrice(props.id);
      console.log("price: " + price.toString());
      setPriceLabel(<PriceLabel sellPrice={price.toString()} />);
    }
  }
  // react hook which will be called after render 
  useEffect(() => {
    loadNFT();
  }, []);

  let price;

  function handleSell() {
    console.log("Sell Clicked");
    setPriceInput(<input
      placeholder="Price in DANG"
      type="number"
      className="price-input"
      value={price}
      onChange={(e) => price = e.target.value}
    />);
    setButton(<Button handleClick={sellItem} text={"Confirm"} />);
  }

  //when confirm button click happens
  async function sellItem() {
    setblur({ filter: "blur(4px" });
    console.log("sell now");
    const listingResult = await opend.listItem(props.id, Number(price));
    console.log("Listing : " + listingResult);
    if (listingResult == "Success") {
      const openDId = await opend.getOpenDCanisterID();
      //Tranfer the OwnerShip to openD when NFT is listed for sell
      const transferResult = await NFTActor.transferOwnerShip(openDId);
      console.log("Transfer :" + transferResult);
      if (transferResult == "Success") {
        setButton();
        setPriceInput();
        setOwner("OpenD");
        setSellStatus("Listed");
      }
    }
  }

  async function handleBuy() {
    console.log("Buy was triggered");

    //create communication between token-local canister and opend canister
    const tokenActor = await Actor.createActor(tokenIdlFactory, {
      agent,
      //canister id of token dfx canister id token
      canisterId: Principal.fromText($ < REPLACE_WITH_TOKEN_CANISTER_ID >),
    });

    const sellerId = await opend.getOrignalOwner(props.id);
    const itemPrice = await opend.getListedNFTPrice(props.id);

    const result = await tokenActor.transfer(sellerId, itemPrice);
    console.log(result);
    if (result == "Success") {
      //transfer ownership
      const transferResult = await opend.completePurchase(props.id, sellerId, CURRENT_USER_ID);
      console.log("Purchase: " + transferResult);
      setDisplay(false);
    }

  }

  return (
    <div style={{ display: shouldDisplay ? "inline" : "none" }} className="disGrid-item">
      <div className="disPaper-root disCard-root makeStyles-root-17 disPaper-elevation1 disPaper-rounded">
        <img
          className="disCardMedia-root makeStyles-image-19 disCardMedia-media disCardMedia-img"
          src={image}
          style={blur}
        />
        <div className="disCardContent-root">
          {priceLabel}
          <h2 className="disTypography-root makeStyles-bodyText-24 disTypography-h5 disTypography-gutterBottom">
            {name} <span className="purple-text"> {sellStatus} </span>
          </h2>
          <p className="disTypography-root makeStyles-bodyText-24 disTypography-body2 disTypography-colorTextSecondary">
            Owner: {owner}
          </p>
          {priceInput}
          {button}
        </div>
      </div>
    </div>
  );
}

export default Item;
