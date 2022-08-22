import { ClientOnly } from "remix-utils";
import Player from "~/utils/player";

export default function Index() {
    return (
        <ClientOnly>
            { () => <Player/> }
        </ClientOnly>
    );
}
