import { type SongMetadata } from "../../server/types";

export default function Queue(props: any) {
	const { queue }: { queue: SongMetadata[] } = props;

	return queue.length > 0 ? (
		<div className={"w-full"}>
			<h2 className={"mt-10 text-center font-bold tracking-wide"}>Queue</h2>
			<div className={"mt-5 w-full flex flex-col space-y-2"}>
				{queue.slice(0, 10).map((song: SongMetadata) => (
					<div
						className={
							"flex flex-row space-x-6 p-2 w-full border-t-2 border-slate-200"
						}
					>
						<img src={song.cover} alt={song.title} height={64} width={64} />

						<div className={"flex flex-col m-auto text-left"}>
							<h2 className={"font-bold"}>{song.title}</h2>

							<p>{song.artist}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	) : (
		<div>
			<h2 className={"mt-10 italic text-center"}>🪗 No songs queued up...</h2>
		</div>
	);
}
