import ClientPlayer from "~/utils/player";
import { ClientOnly } from "remix-utils";

export default function Index() {
    return (
        <ClientOnly>
            { () => <ClientPlayer/> }
        </ClientOnly>
    );
}
