import BN from "bn.js"
import { Cell, beginCell, Address, toNano, beginDict } from "ton"

import walletHex from "./contracts/jetton-wallet-bitcode.json"
import minterHex from "./contracts/jetton-minter-bitcode.json"
import { Sha256 } from "@aws-crypto/sha256-js"

const ONCHAIN_CONTENT_PREFIX = 0x00
const SNAKE_PREFIX = 0x00

export const JETTON_WALLET_CODE = Cell.fromBoc(walletHex.hex)[0]
export const JETTON_MINTER_CODE = Cell.fromBoc(minterHex.hex)[0] // code cell from build output

enum OPS {
  Mint = 21,
  InternalTransfer = 0x178d4519,
  Transfer = 0xf8a7ea5,
}

export type JettonMetaDataKeys = "name" | "description" | "image" | "symbol"

const jettonOnChainMetadataSpec: {
  [key in JettonMetaDataKeys]: "utf8" | "ascii" | undefined
} = {
  name: "utf8",
  description: "utf8",
  image: "ascii",
  symbol: "utf8",
}

const sha256 = (str: string) => {
  const sha = new Sha256()
  sha.update(str)
  return Buffer.from(sha.digestSync())
}

// TODO: support for vals over 1024 bytes (otherwise it'll fail here)
export function buildOnChainData(data: {
  [s: string]: string | undefined
}): Cell {
  const KEYLEN = 256
  const dict = beginDict(KEYLEN)

  Object.entries(data).forEach(([k, v]: [string, string | undefined]) => {
    if (!jettonOnChainMetadataSpec[k as JettonMetaDataKeys])
      throw new Error(`Unsupported onchain key: ${k}`)
    if (v === undefined) return

    dict.storeCell(
      sha256(k),
      beginCell()
        .storeUint8(SNAKE_PREFIX)
        .storeBuffer(
          Buffer.from(v, jettonOnChainMetadataSpec[k as JettonMetaDataKeys])
        ) // TODO imageUri is supposed to be saved ascii
        .endCell()
    )
  })

  return beginCell()
    .storeInt(ONCHAIN_CONTENT_PREFIX, 8)
    .storeDict(dict.endDict())
    .endCell()
}

export function parseOnChainData(contentCell: Cell): {
  [s in JettonMetaDataKeys]?: string
} {
  // Note that this relies on what is (perhaps) an internal implementation detail:
  // "ton" library dict parser converts: key (provided as buffer) => BN(base10)
  // and upon parsing, it reads it back to a BN(base10)
  // tl;dr if we want to read the map back to a JSON with string keys, we have to convert BN(10) back to hex
  const toKey = (str: string) => new BN(str, "hex").toString(10)

  const KEYLEN = 256
  const contentSlice = contentCell.beginParse()
  if (contentSlice.readUint(8).toNumber() !== ONCHAIN_CONTENT_PREFIX)
    throw new Error("Expected onchain content marker")

  const dict = contentSlice.readDict(KEYLEN, (s) => {
    const valSlice = s.toCell().beginParse()
    if (valSlice.readUint(8).toNumber() !== SNAKE_PREFIX)
      throw new Error("Only snake format is supported")
    return valSlice.readRemainingBytes()
  })

  const res: { [s in JettonMetaDataKeys]?: string } = {}

  Object.keys(jettonOnChainMetadataSpec).forEach((k) => {
    const val = dict
      .get(toKey(sha256(k).toString("hex")))
      ?.toString(jettonOnChainMetadataSpec[k as JettonMetaDataKeys])
    if (val) res[k as JettonMetaDataKeys] = val
  })

  return res
}

export function initData(
  owner: Address,
  data: { [s in JettonMetaDataKeys]?: string | undefined }
) {
  return beginCell()
    .storeCoins(0) // total
    .storeAddress(owner) // 钱包地址
    .storeRef(buildOnChainData(data)) // 单元格数据
    .storeRef(JETTON_WALLET_CODE) // jetton wallet code
    .endCell()
}

export function mintBody(owner: Address, jettonValue: BN): Cell {
  return beginCell()
    .storeUint(OPS.Mint, 32) // opcode (reference TODO)
    .storeUint(0, 64) // queryid
    .storeAddress(owner)
    .storeCoins(toNano(0.2)) // gas fee
    .storeRef(
      // internal transfer message
      beginCell()
        .storeUint(OPS.InternalTransfer, 32)
        .storeUint(0, 64)
        .storeCoins(jettonValue)
        .storeAddress(null) // TODO FROM?
        .storeAddress(null) // TODO RESP?
        .storeCoins(0)
        .storeBit(false) // forward_payload in this slice, not separate cell
        .endCell()
    )
    .endCell()
}
