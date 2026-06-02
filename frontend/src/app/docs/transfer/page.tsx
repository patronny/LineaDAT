import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transfer" };

export default function TransferDocPage() {
  return (
    <>
      <h1>Transfer</h1>

      <p>
        All <code>$XXXDAT</code> tokens are{" "}
        <strong>non-transferable</strong> through regular wallet-to-wallet
        transfers.
      </p>

      <p>
        But over time, users may have a legitimate reason to move their tokens:
      </p>

      <ul>
        <li>switch to a new wallet</li>
        <li>send tokens to another person</li>
        <li>move assets to a safer address</li>
      </ul>

      <p>For this, we will launch a separate interface on our website:</p>

      <p>
        <a href="https://www.on-chaindat.com/transfer">
          https://www.on-chaindat.com/transfer
        </a>
      </p>

      <p>
        The transfer will work through a special intermediary contract.
      </p>

      <p>
        The principle is similar to how <code>$veAERO</code> positions are moved
        on Aerodrome.
      </p>

      <p>
        <strong>How it will work:</strong>
      </p>

      <ul>
        <li>you connect your wallet</li>
        <li>
          enter the amount of <code>$XXXDAT</code>
        </li>
        <li>enter the recipient address</li>
        <li>approve the contract to spend only that specific amount</li>
        <li>click &ldquo;Send&rdquo;</li>
        <li>
          the contract takes the specified amount of <code>$XXXDAT</code> from
          your wallet and sends it to the selected address
        </li>
      </ul>

      <p>
        <strong>Important:</strong>
      </p>

      <ul>
        <li>
          regular <code>$XXXDAT</code> transfers between wallets are disabled
        </li>
        <li>
          transfers are only possible through the official interface and the
          special contract
        </li>
        <li>
          the contract receives permission only for the exact amount you choose
        </li>
        <li>tokens cannot be moved without your confirmation in your wallet</li>
      </ul>
    </>
  );
}
