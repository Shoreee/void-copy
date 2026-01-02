import React, { useEffect, useState } from 'react';

export const IconX = ({ size, className = '', ...props }: { size: number, className?: string } & React.SVGProps<SVGSVGElement>) => {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			className={className}
			{...props}
		>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				d='M6 18 18 6M6 6l12 12'
			/>
		</svg>
	);
};

export const IconArrowUp = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			width={size}
			height={size}
			className={className}
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fill="black"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
			></path>
		</svg>
	);
};


export const IconSquare = ({ size, className = '', style }: { size: number, className?: string, style?: React.CSSProperties }) => {
	return (
		<svg
			className={className}
			stroke={style?.stroke as string || "black"}
			fill={style?.fill as string || "black"}
			strokeWidth="0"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<rect x="2" y="2" width="20" height="20" rx="4" ry="4" />
		</svg>
	);
};


export const IconWarning = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			stroke="currentColor"
			fill="currentColor"
			strokeWidth="0"
			viewBox="0 0 16 16"
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.7L8 2.28zM8.625 12v-1h-1.25v1h1.25zm-1.25-2V6h1.25v4h-1.25z"
			/>
		</svg>
	);
};


export const IconLoading = ({ className = '' }: { className?: string }) => {

	const [loadingText, setLoadingText] = useState('.');

	useEffect(() => {
		let intervalId;

		// Function to handle the animation
		const toggleLoadingText = () => {
			if (loadingText === '...') {
				setLoadingText('.');
			} else {
				setLoadingText(loadingText + '.');
			}
		};

		// Start the animation loop
		intervalId = setInterval(toggleLoadingText, 300);

		// Cleanup function to clear the interval when component unmounts
		return () => clearInterval(intervalId);
	}, [loadingText, setLoadingText]);

	return <div className={`${className}`}>{loadingText}</div>;

}

export const IconChat = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			viewBox="0 0 1024 1024"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			fill="currentColor"
		>
			<path d="M608 160v64H423.36A263.36 263.36 0 0 0 160 487.36c0 160.96 124.16 282.624 380.8 364.608l3.2 0.96V768a32 32 0 0 1 26.24-31.488L576 736h32a256 256 0 0 0 256-256h64a320 320 0 0 1-320 320V896a32 32 0 0 1-35.712 31.808l-5.12-1.024C256.448 837.952 96 691.712 96 487.36A327.36 327.36 0 0 1 423.36 160H608zM704 512v64H320V512h384z m79.488-324.032c8.128 31.168 21.824 56.192 41.088 75.52 19.2 19.2 44.288 32.896 75.52 41.024 15.872 4.16 15.872 26.816 0 30.976-31.232 8.128-56.32 21.824-75.52 41.088-19.2 19.2-32.96 44.288-41.088 75.52-4.16 15.872-26.816 15.872-30.976 0-8.128-31.232-21.824-56.32-41.088-75.52-19.2-19.2-44.288-32.96-75.52-41.088-15.872-4.16-15.872-26.816 0-30.976 31.232-8.128 56.32-21.824 75.52-41.088 19.2-19.2 32.96-44.288 41.088-75.52 4.16-15.872 26.816-15.872 30.976 0zM512 384v64H320V384h192z" />
		</svg>
	);
};

export const IconAsk = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			viewBox="0 0 1024 1024"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			fill="currentColor"
		>
			<path d="M512 96a415.36 415.36 0 0 1 137.664 23.36l-21.12 60.352a352 352 0 0 0-421.184 508.672 32 32 0 0 1 4.096 19.776c-1.984 16.896-6.592 54.4-13.76 112.384l-0.896 6.592 6.848-0.768c53.44-6.592 89.792-10.88 109.184-12.8l4.864-0.448a32 32 0 0 1 18.88 4.16 352 352 0 0 0 507.648-421.76l60.416-21.184a416 416 0 0 1-582.72 507.776l-8-4.352-7.168 0.768c-25.472 2.816-67.52 7.872-126.208 15.168l-16.576 2.048a32 32 0 0 1-35.712-35.712c9.216-73.856 15.36-123.584 18.432-149.12l-4.224-7.68A416 416 0 0 1 512 96zM512 640a48 48 0 1 1 0 96 48 48 0 0 1 0-96z m0-352c74.24 0 134.4 60.16 134.4 134.4 0 53.248-29.568 93.952-83.648 118.4a32 32 0 0 0-18.752 28.992V608h-64v-38.272a96 96 0 0 1 56.32-87.232c32.384-14.656 46.08-33.472 46.08-60.096a70.4 70.4 0 0 0-140.8 0h-64c0-74.24 60.16-134.4 134.4-134.4z m271.488-164.032c8.128 31.168 21.824 56.192 41.088 75.52 19.2 19.2 44.288 32.896 75.52 41.024 15.872 4.16 15.872 26.816 0 30.976-31.232 8.128-56.32 21.824-75.52 41.088-19.2 19.2-32.96 44.288-41.088 75.52-4.16 15.872-26.816 15.872-30.976 0-8.128-31.232-21.824-56.32-41.088-75.52-19.2-19.2-44.288-32.96-75.52-41.088-15.872-4.16-15.872-26.816 0-30.976 31.232-8.128 56.32-21.824 75.52-41.088 19.2-19.2 32.96-44.288 41.088-75.52 4.16-15.872 26.816-15.872 30.976 0z" />
		</svg>
	);
};

export const IconPlan = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			viewBox="0 0 1024 1024"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			fill="currentColor"
		>
			<path d="M192 704v32A96 96 0 0 0 288 832H512v64H288A160 160 0 0 1 128 736V704h64z m726.656-150.656c47.808 47.872 47.808 125.44 0 173.312l-160 160A32 32 0 0 1 736 896h-128a32 32 0 0 1-32-32v-128a32 32 0 0 1 9.344-22.656l160-160a122.496 122.496 0 0 1 173.312 0z m-128 45.312l-150.72 150.528V832l82.752 0.064 96-96.064-57.344-57.28 45.312-45.312 57.28 57.344 9.408-9.344a58.496 58.496 0 0 0 5.248-76.736l-5.248-5.952a58.496 58.496 0 0 0-82.688 0zM224 608v64h-128v-64h128zM192 448v128H128V448h64z m320 32v64H320v-64h192zM736 128A160 160 0 0 1 896 288V448h-64V288A96 96 0 0 0 736 192h-448A96 96 0 0 0 192 288V320H128v-32A160 160 0 0 1 288 128h448z m-512 224v64h-128v-64h128zM704 320v64H320V320h384z" fill="#222222" p-id="1197" />
		</svg>
	);
};

export const IconAgent = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			viewBox="0 0 1024 1024"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			fill="currentColor"
		>
			<path d="M576 192v64H352A160 160 0 0 0 192 416v192A160 160 0 0 0 352 768h320A160 160 0 0 0 832 608v-192h64v192a224 224 0 0 1-224 224h-320A224 224 0 0 1 128 608v-192A224 224 0 0 1 352 192H576z m73.344 217.344l45.312 45.312-3.52 3.456-39.168 39.168-12.608 12.608L637.248 512l57.408 57.344-45.312 45.312-80-80a32 32 0 0 1 0-45.312l17.28-17.28 20.096-20.032 21.12-21.184 3.84-3.712 14.208-14.272 3.456-3.52zM432 416v192H352v-192h80z m351.488-292.032c8.128 31.168 21.824 56.192 41.088 75.52 19.2 19.2 44.288 32.896 75.52 41.024 15.872 4.16 15.872 26.816 0 30.976-31.232 8.128-56.32 21.824-75.52 41.088-19.2 19.2-32.96 44.288-41.088 75.52-4.16 15.872-26.816 15.872-30.976 0-8.128-31.232-21.824-56.32-41.088-75.52-19.2-19.2-44.288-32.96-75.52-41.088-15.872-4.16-15.872-26.816 0-30.976 31.232-8.128 56.32-21.824 75.52-41.088 19.2-19.2 32.96-44.288 41.088-75.52 4.16-15.872 26.816-15.872 30.976 0z" />
		</svg>
	);
}

export const IconStudy = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			viewBox="0 0 1024 1024"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			fill="currentColor"
		>
			<path d="M736 512a160 160 0 0 1 133.504 248.256l81.152 81.088-45.312 45.312-81.152-81.152A160 160 0 1 1 736 512z m124.992-352.192l25.792 0.256H896V448h-64V223.552h-23.232c-17.28 0.192-30.848 0.64-45.824 1.6-100.992 6.4-169.408 35.52-219.008 104.896L544 512h-64V330.112l-3.136-4.48c-49.28-66.176-116.864-94.08-215.808-100.352a939.52 939.52 0 0 0-68.992-1.664L192 638.208a96 96 0 0 0 70.72 92.672l249.536 67.968 56-13.888 15.488 62.08-64 16a32 32 0 0 1-16.192-0.192l-257.664-70.272A160 160 0 0 1 128 638.208v-478.08h9.472l26.432-0.256c49.216-0.512 72.384-0.32 101.248 1.536 105.28 6.656 184.96 36.352 245.056 103.872L512 267.392l1.792-2.176c56.768-63.744 131.008-93.824 227.776-102.592l17.28-1.344c16.192-1.024 30.592-1.536 48.704-1.728h23.872c8.832 0 18.56 0.128 29.568 0.256zM736 576a96 96 0 1 0 0 192 96 96 0 0 0 0-192z" />
		</svg>
	);
}

export const IconEdit = ({ size, className = '' }: { size: number, className?: string }) => {
	return (
		<svg
			className={className}
			viewBox="0 0 1024 1024"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			fill="currentColor"
		>
			<path d="M580.775 203.428c31.242-31.242 81.895-31.242 113.137 0l117.107 117.106c31.241 31.242 31.241 81.895 0 113.137L432.353 812.337a80 80 0 0 1-49.911 23.154l-127.779 10.673-1.153 0.088c-48.415 3.36-88.674-36.9-85.315-85.314l0.087-1.155 10.673-127.779a80.003 80.003 0 0 1 23.154-49.91l378.666-378.666z m244.194 573.58c17.673 0 32 14.327 32 32 0 17.673-14.327 32-32 32H581.09c-17.673 0-32-14.327-32-32 0-17.673 14.327-32 32-32h243.879zM247.364 627.349a16.002 16.002 0 0 0-4.631 9.982l-10.672 127.778c-0.824 9.863 7.413 18.099 17.276 17.276l127.779-10.671a16.003 16.003 0 0 0 9.982-4.632l272.646-272.646L520.01 354.702 247.364 627.349z m401.293-378.666c-6.248-6.249-16.378-6.249-22.627 0l-60.765 60.764 139.734 139.734 60.765-60.765c6.248-6.248 6.248-16.379 0-22.627L648.657 248.683z" />
		</svg>
	);
}
