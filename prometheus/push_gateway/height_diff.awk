BEGIN {
	height_diff=0;
}
{
	height_diff=height_diff+$3;
}
END {
	print height_diff
}